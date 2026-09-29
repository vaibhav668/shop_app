import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { authOk, mockApi, renderApp } from './renderApp';

const expired = {
  status: 401,
  body: { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } },
};

describe('admin sign-in', () => {
  it('sends signed-out visitors to the sign-in page', async () => {
    mockApi({ '/auth/refresh': expired });
    const router = renderApp('/orders');
    expect(await screen.findByRole('heading', { name: 'Bada Bazar admin' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it('returns to the page they wanted after signing in', async () => {
    mockApi({ '/auth/refresh': expired, '/auth/dev-login': authOk() });
    const router = renderApp('/orders');

    await userEvent.type(await screen.findByLabelText('Development sign-in'), 'owner@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/orders');
  });

  it('explains when the account is not an admin', async () => {
    mockApi({
      '/auth/refresh': expired,
      '/auth/dev-login': {
        status: 403,
        body: { error: { code: 'FORBIDDEN', message: "This Google account isn't a shop admin." } },
      },
    });
    renderApp('/');

    await userEvent.type(await screen.findByLabelText('Development sign-in'), 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("isn't a shop admin");
  });

  it('signs out from the sidebar', async () => {
    const fetchMock = mockApi({ '/auth/refresh': authOk(), '/auth/logout': { status: 204 } });
    const router = renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Bada Bazar admin' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    const logout = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/logout'));
    expect(logout?.[1]).toMatchObject({ credentials: 'include' });
  });
});
