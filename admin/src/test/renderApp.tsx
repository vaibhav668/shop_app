import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthProvider';
import { routes } from '@/routes';

export const OWNER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'owner@example.com',
  name: 'Meena Shah',
  avatar_url: null,
  phone: '9876543210',
  role: 'ADMIN',
  needs_onboarding: false,
};

type Handler = (url: string, init: RequestInit) => { status: number; body?: unknown };

export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function authOk(user = OWNER) {
  return {
    status: 200,
    body: {
      access_token: 'access',
      token_type: 'bearer',
      expires_in: 900,
      user,
      is_new_user: false,
    },
  };
}

/**
 * Mocks fetch. Keys are "/path" (any method) or "METHOD /path"; the path is matched against the
 * end of the URL's pathname, so query strings don't matter. Unmatched requests fail loudly.
 */
export function mockApi(handlers: Record<string, Handler | ReturnType<Handler>>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const pathname = new URL(url).pathname;
    const method = (init.method ?? 'GET').toUpperCase();
    const key =
      Object.keys(handlers).find(
        (k) => k === `${method} ${k.split(' ')[1]}` && pathname.endsWith(k.split(' ')[1]),
      ) ?? Object.keys(handlers).find((k) => !k.includes(' ') && pathname.endsWith(k));
    if (!key) throw new Error(`Unexpected request: ${method} ${url}`);
    const h = handlers[key];
    const { status, body } = typeof h === 'function' ? h(url, init) : h;
    return jsonResponse(status, body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderApp(path: string) {
  // A fresh cache per test so one test's data never leaks into the next.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}
