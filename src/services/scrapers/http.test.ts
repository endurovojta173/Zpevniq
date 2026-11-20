import type { HttpOptions, HttpResponse } from '@capacitor/core';
import { describe, expect, it, vi } from 'vitest';
import { type HttpTransport, assertSafeHttpUrl, httpGet, resolveSafeUrl } from './http';

function createTransport(
  impl: (options: HttpOptions) => Promise<HttpResponse>,
  canExecute = true,
): HttpTransport {
  return {
    canExecute,
    get: vi.fn(impl),
  };
}

describe('scraper http client', () => {
  it('blocks execution with PLATFORM_UNSUPPORTED when native scraping is disabled', async () => {
    const transport = createTransport(async () => ({
      status: 200,
      url: 'https://example.cz',
      headers: {},
      data: 'ok',
    }), false);

    await expect(httpGet({ url: 'https://example.cz' }, transport)).rejects.toMatchObject({
      code: 'PLATFORM_UNSUPPORTED',
      retryable: false,
    });
    expect(transport.get).not.toHaveBeenCalled();
  });

  it('validates URL protocols and rejects unsafe schemes', () => {
    expect(assertSafeHttpUrl('https://www.velkyzpevnik.cz/okor').hostname).toBe(
      'www.velkyzpevnik.cz',
    );
    expect(() => assertSafeHttpUrl('javascript:alert(1)')).toThrow();
    expect(resolveSafeUrl('/lidove/okor', 'https://www.velkyzpevnik.cz')).toBe(
      'https://www.velkyzpevnik.cz/lidove/okor',
    );
    expect(resolveSafeUrl('javascript:void(0)', 'https://www.velkyzpevnik.cz')).toBeNull();
  });

  it('classifies HTTP 404, 429, 500, and Cloudflare challenge responses cleanly', async () => {
    const notFoundTransport = createTransport(async (opts) => ({
      status: 404,
      url: opts.url,
      headers: {},
      data: 'Not found',
    }));
    await expect(httpGet({ url: 'https://example.cz/missing' }, notFoundTransport)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      retryable: false,
    });

    const rateLimitTransport = createTransport(async (opts) => ({
      status: 429,
      url: opts.url,
      headers: {},
      data: 'Too many requests',
    }));
    await expect(httpGet({ url: 'https://example.cz' }, rateLimitTransport)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      statusCode: 429,
      retryable: true,
    });

    const cloudflareTransport = createTransport(async (opts) => ({
      status: 403,
      url: opts.url,
      headers: { Server: 'cloudflare', 'CF-Mitigated': 'challenge' },
      data: '<html><title>Just a moment...</title></html>',
    }));
    await expect(httpGet({ url: 'https://example.cz' }, cloudflareTransport)).rejects.toMatchObject({
      code: 'BLOCKED',
      statusCode: 403,
      retryable: false,
    });

    const serverErrTransport = createTransport(async (opts) => ({
      status: 502,
      url: opts.url,
      headers: {},
      data: 'Bad gateway',
    }));
    await expect(httpGet({ url: 'https://example.cz' }, serverErrTransport)).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      statusCode: 502,
      retryable: true,
    });
  });

  it('decodes windows-1250 base64 responses accurately for Czech diacritics', async () => {
    // "Píseň" in windows-1250: P(0x50) í(0xED) s(0x73) e(0x65) ň(0xF2)
    const win1250Base64 = btoa(String.fromCharCode(0x50, 0xed, 0x73, 0x65, 0xf2));
    const transport = createTransport(async (opts) => {
      expect(opts.responseType).toBe('arraybuffer');
      return {
        status: 200,
        url: opts.url,
        headers: { 'Content-Type': 'text/html; charset=windows-1250' },
        data: win1250Base64,
      };
    });

    const result = await httpGet(
      { url: 'https://legacy.example.cz', encoding: 'windows-1250' },
      transport,
    );
    expect(result.body).toBe('Píseň');
  });

  it('aborts in-flight requests when AbortSignal fires and classifies timeouts', async () => {
    const controller = new AbortController();
    const hangingTransport = createTransport(
      () => new Promise<HttpResponse>(() => undefined),
    );

    const promise = httpGet(
      { url: 'https://slow.example.cz', signal: controller.signal },
      hangingTransport,
    );
    controller.abort();

    await expect(promise).rejects.toMatchObject({
      code: 'ABORTED',
      retryable: false,
    });

    const timeoutTransport = createTransport(async () => {
      throw new Error('SocketTimeoutException: Read timed out');
    });
    await expect(httpGet({ url: 'https://slow.example.cz' }, timeoutTransport)).rejects.toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });
  });
});
