import { API_URL } from '@/lib/config';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type SessionHooks = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
};

let session: SessionHooks = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
};

/** Wired once by AuthProvider: the access token lives in memory, the refresh token in a cookie. */
export function configureApiSession(hooks: SessionHooks) {
  session = hooks;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
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
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // Needed so the browser sends/stores the httpOnly refresh cookie on /auth calls.
      credentials: 'include',
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', "Can't reach the server. Check your connection.", 0);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const e = (await response.json())?.error;
    if (e?.code)
      return new ApiError(e.code, e.message ?? 'Request failed.', response.status, e.details);
  } catch {
    // Non-JSON body — fall through.
  }
  return new ApiError('HTTP_ERROR', 'Something went wrong. Try again?', response.status);
}
