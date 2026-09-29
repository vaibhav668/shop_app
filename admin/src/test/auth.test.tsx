import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SIGN_IN_URL } from '@/pages/SignInPage';

import { authOk, mockApi, OWNER, renderApp } from './renderApp';

const mockGoTo = vi.fn();
vi.mock('@/lib/navigation', () => ({ goTo: (url: string) => mockGoTo(url) }));

beforeEach(() => mockGoTo.mockReset());

const expired = {
  status: 401,
  body: { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } },
};
const quietOrders = { status: 200, body: { pending_count: 0, latest_order_at: null } };
const brokenDashboard = { status: 500, body: {} };
const CODE = 'one-time-handoff-code-0123456789abcdef';

describe('admin sign-in (single sign-in page on the shop)', () => {
  it('sends signed-out visitors to the one sign-in page', async () => {
    mockApi({ '/auth/refresh': expired });
    renderApp('/orders');
    await waitFor(() => expect(mockGoTo).toHaveBeenCalledWith('http://localhost:8081/welcome'));
    expect(SIGN_IN_URL).toBe('http://localhost:8081/welcome');
    // No Google button or form of its own.
    expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('finishes the handoff from the shop and opens the dashboard', async () => {
    let sent: unknown = null;
    mockApi({
      '/auth/refresh': expired,
      '/auth/admin-handoff/redeem': (_url, init) => {
        sent = JSON.parse(String(init.body));
        return authOk();
      },
      '/admin/orders/summary': quietOrders,
      '/admin/dashboard': brokenDashboard,
    });
    const router = renderApp(`/sign-in?handoff=${CODE}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(sent).toEqual({ code: CODE });
    expect(mockGoTo).not.toHaveBeenCalled();
  });

  it('explains an expired link and offers to sign in again', async () => {
    mockApi({
      '/auth/refresh': expired,
      '/auth/admin-handoff/redeem': {
        status: 401,
        body: {
          error: {
            code: 'HANDOFF_INVALID',
            message: 'This sign-in link has expired. Please sign in again.',
          },
        },
      },
    });
    renderApp(`/sign-in?handoff=${CODE}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('expired');
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute(
      'href',
      'http://localhost:8081/welcome',
    );
    expect(mockGoTo).not.toHaveBeenCalled(); // no bounce loop on a bad link
  });

  it('asks a first-time admin for name and mobile, then opens the dashboard', async () => {
    let saved: Record<string, unknown> | null = null;
    const newcomer = { ...OWNER, phone: null, needs_onboarding: true };
    mockApi({
      '/auth/refresh': expired,
      '/auth/admin-handoff/redeem': authOk(newcomer),
      'PATCH /me': (_url, init) => {
        saved = JSON.parse(String(init.body));
        return { status: 200, body: { ...OWNER, ...saved, needs_onboarding: false } };
      },
      '/admin/orders/summary': quietOrders,
      '/admin/dashboard': brokenDashboard,
    });
    const user = userEvent.setup();
    renderApp(`/sign-in?handoff=${CODE}`);

    expect(await screen.findByRole('heading', { name: 'Almost there' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter a 10-digit mobile number.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Mobile number'), '+91 98765 43210');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(saved).toEqual({ name: 'Meena Shah', phone: '9876543210' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('skips straight to the dashboard when already signed in', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': quietOrders,
      '/admin/dashboard': brokenDashboard,
    });
    const router = renderApp('/sign-in');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(mockGoTo).not.toHaveBeenCalled();
  });

  it('signing out returns to the one sign-in page', async () => {
    const fetchMock = mockApi({
      '/auth/refresh': authOk(),
      '/auth/logout': { status: 204 },
      '/admin/orders/summary': quietOrders,
      '/admin/dashboard': brokenDashboard,
    });
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(mockGoTo).toHaveBeenCalledWith('http://localhost:8081/welcome'));
    const logout = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/logout'));
    expect(logout?.[1]).toMatchObject({ credentials: 'include' });
  });
});
