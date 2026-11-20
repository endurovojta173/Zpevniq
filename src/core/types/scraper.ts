export type SearchMatchType = 'title' | 'artist' | 'lyrics';

export interface SongSearchResult {
  readonly id: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly title: string;
  readonly artist: string;
  readonly url: string;
  readonly matchType: SearchMatchType;
  readonly key?: string;
}

export interface ChordProMetadata {
  readonly title: string;
  readonly artist?: string;
  readonly key?: string;
  readonly capo?: number;
}

export interface ScrapedSong {
  readonly providerId: string;
  readonly providerName: string;
  readonly sourceUrl: string;
  readonly title: string;
  readonly artist: string;
  readonly key?: string;
  readonly capo?: number;
  readonly chordproContent: string;
}

export type ScraperErrorCode =
  | 'PLATFORM_UNSUPPORTED'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'BLOCKED'
  | 'NOT_FOUND'
  | 'UPSTREAM_ERROR'
  | 'PARSE_ERROR'
  | 'ABORTED';

export interface ScraperErrorOptions {
  readonly providerId?: string;
  readonly statusCode?: number;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

export class ScraperError extends Error {
  readonly code: ScraperErrorCode;
  readonly providerId?: string;
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(
    code: ScraperErrorCode,
    message: string,
    options: ScraperErrorOptions = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ScraperError';
    this.code = code;
    this.providerId = options.providerId;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? isDefaultRetryable(code);
  }
}

function isDefaultRetryable(code: ScraperErrorCode): boolean {
  return (
    code === 'TIMEOUT' ||
    code === 'NETWORK_ERROR' ||
    code === 'RATE_LIMITED' ||
    code === 'UPSTREAM_ERROR'
  );
}

export function isScraperError(value: unknown): value is ScraperError {
  return value instanceof ScraperError;
}

export type ProviderSearchStatus =
  | {
      readonly providerId: string;
      readonly providerName: string;
      readonly status: 'loading';
    }
  | {
      readonly providerId: string;
      readonly providerName: string;
      readonly status: 'success';
      readonly resultCount: number;
      readonly durationMs: number;
    }
  | {
      readonly providerId: string;
      readonly providerName: string;
      readonly status: 'error';
      readonly error: ScraperError;
    };

export interface AggregatedSearchSnapshot {
  readonly query: string;
  readonly results: readonly SongSearchResult[];
  readonly providerStatuses: readonly ProviderSearchStatus[];
  readonly isComplete: boolean;
}
