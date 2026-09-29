import { API_URL } from '@/lib/config';

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

type SessionHooks = {
  getAccessToken: () => string | null;
  /** Returns a fresh access token, or null if the session is gone. */
  refreshAccessToken: () => Promise<string | null>;
};

let session: SessionHooks = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
};

/** Called once by AuthProvider so every request can attach and renew the access token. */
export function configureApiSession(hooks: SessionHooks) {
  session = hooks;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true } = options;
  const response = await send(path, options, auth ? session.getAccessToken() : null);

  if (auth && response.status === 401) {
    const error = await toApiError(response);
    if (error.code !== 'TOKEN_EXPIRED') throw error;
    const fresh = await session.refreshAccessToken();
    if (!fresh) throw error;
    return parse<T>(await send(path, options, fresh));
  }
  return parse<T>(response);
}

async function send(path: string, options: RequestOptions, token: string | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort());

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new ApiError('TIMEOUT', 'The shop is taking too long to respond.', 0);
    }
    throw new ApiError('NETWORK_ERROR', "You're offline or the shop can't be reached.", 0);
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    const e = body?.error;
    if (e?.code)
      return new ApiError(e.code, e.message ?? 'Request failed.', response.status, e.details);
  } catch {
    // Non-JSON error (proxy page, etc.) — fall through.
  }
  return new ApiError('HTTP_ERROR', 'Something went wrong. Try again?', response.status);
}
