import { CapacitorHttp, type HttpOptions, type HttpResponse } from '@capacitor/core';
import { ScraperError, isScraperError } from '../../core/types/scraper';
import { platform } from '../platform';

export type TextEncoding = 'utf-8' | 'windows-1250' | 'iso-8859-2';

export interface ScraperHttpRequestOptions {
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly params?: Readonly<Record<string, string>>;
  readonly connectTimeoutMs?: number;
  readonly readTimeoutMs?: number;
  readonly encoding?: TextEncoding;
  readonly signal?: AbortSignal;
  readonly providerId?: string;
}

export interface ScraperHttpResult {
  readonly status: number;
  readonly url: string;
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface HttpTransport {
  readonly canExecute: boolean;
  get(options: HttpOptions): Promise<HttpResponse>;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 8_000;
const DEFAULT_READ_TIMEOUT_MS = 10_000;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const DEFAULT_HEADERS: Readonly<Record<string, string>> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
  'User-Agent': DEFAULT_USER_AGENT,
  'x-cap-user-agent': DEFAULT_USER_AGENT,
};

const BLOCK_SIGNATURE_REGEX =
  /(?:cf-challenge|cf-browser-verification|just a moment\.\.\.|challenges\.cloudflare\.com|turnstile|g-recaptcha|hcaptcha|attention required! \| cloudflare)/i;

const capacitorTransport: HttpTransport = {
  get canExecute(): boolean {
    return platform.canScrape;
  },
  get(options: HttpOptions): Promise<HttpResponse> {
    return CapacitorHttp.get(options);
  },
};

/**
 * Validates that a URL uses an explicit HTTP(S) scheme, preventing javascript:,
 * data:, or file: schemes from untrusted scraped HTML links.
 */
export function assertSafeHttpUrl(rawUrl: string, providerId?: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new ScraperError('PARSE_ERROR', `Invalid URL: ${rawUrl}`, {
      providerId,
      retryable: false,
      cause: error,
    });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ScraperError('PARSE_ERROR', `Unsupported URL protocol: ${parsed.protocol}`, {
      providerId,
      retryable: false,
    });
  }

  return parsed;
}

/**
 * Safely resolves a potentially relative href against a provider base URL.
 * Returns null if the resolved URL is invalid or uses a non-HTTP(S) protocol.
 */
export function resolveSafeUrl(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function decodeBase64Bytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeResponseBody(
  data: unknown,
  encoding: TextEncoding,
  providerId?: string,
): string {
  if (encoding === 'utf-8') {
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data);
    }
    if (data !== null && data !== undefined) {
      return String(data);
    }
    return '';
  }

  if (typeof data !== 'string') {
    throw new ScraperError('PARSE_ERROR', 'Expected base64 payload for non-UTF-8 response.', {
      providerId,
      retryable: false,
    });
  }

  try {
    const bytes = decodeBase64Bytes(data);
    return new TextDecoder(encoding).decode(bytes);
  } catch (error) {
    throw new ScraperError('PARSE_ERROR', `Failed to decode response using ${encoding}.`, {
      providerId,
      retryable: false,
      cause: error,
    });
  }
}

function normalizeHeaders(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      normalized[key.toLowerCase()] = value;
    }
  }
  return normalized;
}

function isAntiBotChallenge(status: number, body: string, headers: Readonly<Record<string, string>>): boolean {
  if (status !== 403 && status !== 503) {
    return false;
  }
  if (headers['cf-mitigated'] === 'challenge') {
    return true;
  }
  return BLOCK_SIGNATURE_REGEX.test(body.slice(0, 8_192));
}

function raceWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  providerId?: string,
): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(
      new ScraperError('ABORTED', 'Request aborted.', { providerId, retryable: false }),
    );
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new ScraperError('ABORTED', 'Request aborted.', { providerId, retryable: false }));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function classifyTransportError(error: unknown, providerId?: string): ScraperError {
  if (isScraperError(error)) {
    return error;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new ScraperError('OFFLINE', 'Device appears to be offline.', {
      providerId,
      retryable: true,
      cause: error,
    });
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('sockettimeout')) {
    return new ScraperError('TIMEOUT', `Request timed out: ${rawMessage}`, {
      providerId,
      retryable: true,
      cause: error,
    });
  }

  if (
    lower.includes('unknownhost') ||
    lower.includes('unreachable') ||
    lower.includes('no address associated') ||
    lower.includes('offline')
  ) {
    return new ScraperError('NETWORK_ERROR', `Network unreachable: ${rawMessage}`, {
      providerId,
      retryable: true,
      cause: error,
    });
  }

  return new ScraperError('NETWORK_ERROR', `HTTP request failed: ${rawMessage}`, {
    providerId,
    retryable: true,
    cause: error,
  });
}

/**
 * Shared client-side HTTP GET wrapper around CapacitorHttp.
 * Enforces native-only execution, timeouts, URL validation, encoding decoding,
 * and typed ScraperError classification without bypassing anti-bot walls.
 */
export async function httpGet(
  options: ScraperHttpRequestOptions,
  transport: HttpTransport = capacitorTransport,
): Promise<ScraperHttpResult> {
  const { providerId } = options;

  if (!transport.canExecute) {
    throw new ScraperError(
      'PLATFORM_UNSUPPORTED',
      'Client-side scraping is only available on native mobile platforms.',
      { providerId, retryable: false },
    );
  }

  if (options.signal?.aborted) {
    throw new ScraperError('ABORTED', 'Request aborted.', { providerId, retryable: false });
  }

  const safeUrl = assertSafeHttpUrl(options.url, providerId);
  const encoding: TextEncoding = options.encoding ?? 'utf-8';

  const requestOptions: HttpOptions = {
    url: safeUrl.toString(),
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers ?? {}),
    },
    ...(options.params ? { params: { ...options.params } } : {}),
    connectTimeout: options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    readTimeout: options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS,
    responseType: encoding === 'utf-8' ? 'text' : 'arraybuffer',
  };

  let response: HttpResponse;
  try {
    response = await raceWithAbort(transport.get(requestOptions), options.signal, providerId);
  } catch (error) {
    throw classifyTransportError(error, providerId);
  }

  const responseHeaders = normalizeHeaders(response.headers);
  const body = decodeResponseBody(response.data, encoding, providerId);
  const status = response.status;

  if (status === 404) {
    throw new ScraperError('NOT_FOUND', `Resource not found (${status}).`, {
      providerId,
      statusCode: status,
      retryable: false,
    });
  }

  if (status === 429) {
    throw new ScraperError('RATE_LIMITED', `Rate limited by upstream source (${status}).`, {
      providerId,
      statusCode: status,
      retryable: true,
    });
  }

  if (isAntiBotChallenge(status, body, responseHeaders)) {
    throw new ScraperError(
      'BLOCKED',
      `Source blocked automated access with an anti-bot challenge (${status}).`,
      {
        providerId,
        statusCode: status,
        retryable: false,
      },
    );
  }

  if (status === 403) {
    throw new ScraperError('BLOCKED', `Access forbidden by source (${status}).`, {
      providerId,
      statusCode: status,
      retryable: false,
    });
  }

  if (status >= 500) {
    throw new ScraperError('UPSTREAM_ERROR', `Upstream server error (${status}).`, {
      providerId,
      statusCode: status,
      retryable: true,
    });
  }

  if (status < 200 || status >= 400) {
    throw new ScraperError('NETWORK_ERROR', `Unexpected HTTP status (${status}).`, {
      providerId,
      statusCode: status,
      retryable: false,
    });
  }

  return {
    status,
    url: response.url || safeUrl.toString(),
    body,
    headers: responseHeaders,
  };
}
