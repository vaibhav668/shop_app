import { render } from '@testing-library/react';
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

/** Mocks fetch by path suffix. Unmatched requests fail loudly. */
export function mockApi(handlers: Record<string, Handler | ReturnType<Handler>>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const key = Object.keys(handlers).find((suffix) => url.endsWith(suffix));
    if (!key) throw new Error(`Unexpected request: ${url}`);
    const h = handlers[key];
    const { status, body } = typeof h === 'function' ? h(url, init) : h;
    return jsonResponse(status, body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}
