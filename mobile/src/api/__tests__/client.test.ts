import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { api, ApiError, configureApiSession } from '@/api/client';

function json(status: number, body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

const fetchMock = jest.fn<typeof fetch>();
globalThis.fetch = fetchMock;

function headersOf(init: RequestInit | undefined) {
  return (init?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  fetchMock.mockReset();
  configureApiSession({ getAccessToken: () => 'old-access', refreshAccessToken: async () => null });
});

describe('api client', () => {
  it('sends the bearer token and parses JSON', async () => {
    fetchMock.mockReturnValueOnce(json(200, { ok: true }));
    await expect(api('/me')).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/me$/);
    expect(headersOf(init)).toMatchObject({ Authorization: 'Bearer old-access' });
  });

  it('turns the error envelope into ApiError', async () => {
    fetchMock.mockReturnValueOnce(
      json(409, { error: { code: 'OUT_OF_STOCK', message: 'Only 2 left.', details: { a: 2 } } }),
    );
    const error = await api('/cart').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'OUT_OF_STOCK', status: 409, details: { a: 2 } });
  });

  it('refreshes once on TOKEN_EXPIRED and retries with the new token', async () => {
    const refresh = jest.fn(async (): Promise<string | null> => 'new-access');
    configureApiSession({ getAccessToken: () => 'old-access', refreshAccessToken: refresh });
    fetchMock
      .mockReturnValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } }))
      .mockReturnValueOnce(json(200, { id: 1 }));

    await expect(api('/me')).resolves.toEqual({ id: 1 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(headersOf(fetchMock.mock.calls[1][1])).toMatchObject({
      Authorization: 'Bearer new-access',
    });
  });

  it('does not refresh for other 401s', async () => {
    const refresh = jest.fn(async (): Promise<string | null> => 'new-access');
    configureApiSession({ getAccessToken: () => 'x', refreshAccessToken: refresh });
    fetchMock.mockReturnValueOnce(
      json(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } }),
    );
    await expect(api('/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reports network failures as offline', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    const error = (await api('/me').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.isNetworkError).toBe(true);
  });

  it('omits the token for public calls', async () => {
    fetchMock.mockReturnValueOnce(json(200, {}));
    await api('/auth/google', { method: 'POST', body: {}, auth: false });
    expect(headersOf(fetchMock.mock.calls[0][1])).not.toHaveProperty('Authorization');
  });
});
