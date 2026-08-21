/**
 * Fetch wrapper for the veto-core REST API.
 *
 * - Sends `X-Veto-Session-Token` when a token is stored.
 * - Sends `Accept-Language` with the UI's current language so backend error
 *   messages arrive already localized.
 * - Normalizes the backend's three error shapes into ApiError:
 *     1. {"status":"error","message":"..."}        (auth / tasks / veto)
 *     2. {"error":"..."}                            (prompt endpoint)
 *     3. {"timestamp","status","error","message"}   (Spring default for thrown exceptions)
 * - 401 responses notify onUnauthorized (tokens are in-memory server-side,
 *   so a backend restart invalidates them → UI routes back to login).
 */

import { currentLang } from '../i18n/lang';
import { backendApiUrl } from '../config/backend';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const TOKEN_KEY = 'veto.session.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Register the callback fired when any request comes back 401. */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

type HttpErrorLocalizer = (status: number) => string;

const defaultHttpErrorLocalizer: HttpErrorLocalizer = (status) =>
  `Request failed (HTTP ${status})`;

let httpErrorLocalizer: HttpErrorLocalizer = defaultHttpErrorLocalizer;

/**
 * Override the transport-level fallback message for non-2xx responses with an
 * empty/unrecognized body. The i18n layer registers a localized one at
 * startup; pass null to restore the default. Keeps this module React-free.
 */
export function setHttpErrorLocalizer(localizer: HttpErrorLocalizer | null): void {
  httpErrorLocalizer = localizer ?? defaultHttpErrorLocalizer;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
  body?: unknown;
  /** Abort signal from the caller (e.g. Composer cancel). */
  signal?: AbortSignal;
  /** Milliseconds before the request aborts itself. Default 30s. */
  timeoutMs?: number;
}

/** Extract a human message from any of the three backend error shapes. */
export function errorMessageFromBody(body: unknown, fallback: string): string {
  if (body !== null && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    // Spring's default error body carries both `message` and `error`;
    // `message` is the specific one, `error` is the status phrase ("Not Found").
    if (typeof record.message === 'string' && record.message.length > 0) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.length > 0) {
      return record.error;
    }
  }
  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = 30_000 } = options;

  const headers: Record<string, string> = {
    'Accept-Language': currentLang(),
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token !== null) {
    headers['X-Veto-Session-Token'] = token;
  }

  // Combine the caller's signal with our own timeout.
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  const onCallerAbort = (): void => timeoutController.abort();
  if (signal !== undefined) {
    if (signal.aborted) {
      clearTimeout(timeout);
      timeoutController.abort();
    } else {
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(backendApiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutController.signal,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  if (response.status === 401) {
    setToken(null);
    unauthorizedHandler?.();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, errorMessageFromBody(parsed, httpErrorLocalizer(response.status)));
  }

  return parsed as T;
}
