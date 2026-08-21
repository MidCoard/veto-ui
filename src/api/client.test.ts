import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ApiError,
  apiRequest,
  errorMessageFromBody,
  getToken,
  onUnauthorized,
  setHttpErrorLocalizer,
  setToken,
} from './client';
import { setBackendPort } from '../config/backend';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('errorMessageFromBody', () => {
  it('prefers the message field (auth/tasks/veto and Spring default shapes)', () => {
    expect(errorMessageFromBody({ status: 'error', message: 'Invalid username or password' }, 'x'))
      .toBe('Invalid username or password');
    expect(
      errorMessageFromBody(
        { timestamp: '2026-08-10T00:00:00Z', status: 500, error: 'Internal Server Error', message: 'Not logged in', path: '/api/sessions' },
        'x',
      ),
    ).toBe('Not logged in');
  });

  it('falls back to the error field (prompt endpoint shape)', () => {
    expect(errorMessageFromBody({ error: 'Empty prompt' }, 'x')).toBe('Empty prompt');
  });

  it('uses the fallback for unrecognized bodies', () => {
    expect(errorMessageFromBody(null, 'Request failed (HTTP 500)')).toBe('Request failed (HTTP 500)');
    expect(errorMessageFromBody({}, 'fallback')).toBe('fallback');
  });
});

describe('apiRequest', () => {
  beforeEach(() => {
    localStorage.clear();
    onUnauthorized(null);
    setHttpErrorLocalizer(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the stored token as X-Veto-Session-Token', async () => {
    setToken('tok-123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/auth/status');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Veto-Session-Token']).toBe('tok-123');
  });

  it('sends requests to the configured backend port', async () => {
    setBackendPort(9443);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/auth/status');

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:9443/api/auth/status');
  });

  it('omits the token header when no token is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/auth/status');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Veto-Session-Token']).toBeUndefined();
  });

  it('sends the stored UI language as Accept-Language', async () => {
    localStorage.setItem('veto.lang', 'zh-CN');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/auth/status');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Accept-Language']).toBe('zh-CN');
  });

  it('serializes the body as JSON with a content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/auth/login', { method: 'POST', body: { username: 'u', password: 'p' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"username":"u","password":"p"}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('throws ApiError with the normalized message on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { error: "Session 'x' not found for user 'u'" }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = apiRequest('/api/sessions/x/prompt', { method: 'POST', body: { prompt: 'hi' } });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 404, message: "Session 'x' not found for user 'u'" });
  });

  it('clears the token and notifies on 401', async () => {
    setToken('dead-token');
    const handler = vi.fn();
    onUnauthorized(handler);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { status: 'error', message: 'Invalid or expired session' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/api/auth/logout', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);

    expect(getToken()).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns undefined for 204 No Content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/api/sessions/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('handles non-JSON error bodies gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/api/tasks')).rejects.toMatchObject({
      status: 502,
      message: 'Request failed (HTTP 502)',
    });
  });

  it('uses the registered localizer for the transport fallback message', async () => {
    setHttpErrorLocalizer((status) => `localized failure ${status}`);
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/api/tasks')).rejects.toMatchObject({
      status: 503,
      message: 'localized failure 503',
    });
  });

  it('restores the default fallback when the localizer is cleared', async () => {
    setHttpErrorLocalizer((status) => `localized failure ${status}`);
    setHttpErrorLocalizer(null);
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/api/tasks')).rejects.toMatchObject({
      message: 'Request failed (HTTP 500)',
    });
  });
});
