import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SHOP_REDIRECT_DELAY_MS } from '@/pages/SignInPage';

import { authOk, mockApi, OWNER, renderApp } from './renderApp';
import { googleMocks, TEST_GOOGLE_CREDENTIAL } from './setup';

const mockGoTo = vi.fn();
vi.mock('@/lib/navigation', () => ({ goTo: (url: string) => mockGoTo(url) }));

beforeEach(() => {
  mockGoTo.mockReset();
  googleMocks.googleLogout.mockReset();
});

const expired = {
  status: 401,
  body: { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } },
};
const quietOrders = { status: 200, body: { pending_count: 0, latest_order_at: null } };
const emptyPage = { status: 200, body: { items: [], total: 0, limit: 20, offset: 0 } };

describe('admin sign-in', () => {
  it('offers only Continue with Google', async () => {
    mockApi({ '/auth/refresh': expired });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Bada Bazar admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.queryByText(/email/i)).toBeNull();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('signs a returning admin in automatically (Google One Tap) and opens the dashboard', async () => {
    googleMocks.oneTapLogin.mockImplementation(
      ({ onSuccess }: { onSuccess: (r: { credential: string }) => void }) => {
        useEffect(() => onSuccess({ credential: TEST_GOOGLE_CREDENTIAL }), [onSuccess]);
      },
    );
    mockApi({
      '/auth/refresh': expired,
      '/auth/google': authOk(),
      '/admin/orders/summary': quietOrders,
      '/admin/dashboard': { status: 500, body: {} },
    });
    const router = renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(googleMocks.oneTapLogin).toHaveBeenCalledWith(
      expect.objectContaining({ auto_select: true }),
    );
    googleMocks.oneTapLogin.mockReset();
  });

  it('sends signed-out visitors to sign in, then back where they were going', async () => {
    let sent: Record<string, unknown> | null = null;
    mockApi({
      '/auth/refresh': expired,
      '/auth/google': (_url, init) => {
        sent = JSON.parse(String(init.body));
        return authOk();
      },
      '/admin/orders/summary': quietOrders,
      '/admin/orders': emptyPage,
    });
    const router = renderApp('/orders');
    expect(router.state.location.pathname).toBe('/orders');

    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/orders');
    expect(sent).toEqual({ id_token: TEST_GOOGLE_CREDENTIAL, client: 'admin' });
  });

  it('sends a customer who signs in here on to the shop', async () => {
    mockApi({
      '/auth/refresh': expired,
      '/auth/google': {
        status: 403,
        body: { error: { code: 'FORBIDDEN', message: 'Admins only.' } },
      },
    });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));

    expect(
      await screen.findByRole('heading', { name: 'Taking you to the shop…' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the shop now' })).toHaveAttribute(
      'href',
      'http://localhost:8081',
    );
    // Google's auto sign-in must not keep choosing this customer account here.
    expect(googleMocks.googleLogout).toHaveBeenCalled();
    await waitFor(() => expect(mockGoTo).toHaveBeenCalledWith('http://localhost:8081'), {
      timeout: SHOP_REDIRECT_DELAY_MS + 1000,
    });
  });

  it('lets the owner go back and pick their admin account instead', async () => {
    mockApi({
      '/auth/refresh': expired,
      '/auth/google': {
        status: 403,
        body: { error: { code: 'FORBIDDEN', message: 'Admins only.' } },
      },
    });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    await userEvent.click(await screen.findByRole('button', { name: /use a different account/ }));
    expect(screen.getByRole('heading', { name: 'Bada Bazar admin' })).toBeInTheDocument();
    expect(mockGoTo).not.toHaveBeenCalled();
  });

  it('asks a first-time admin for name and mobile, then opens the dashboard', async () => {
    let saved: Record<string, unknown> | null = null;
    const newcomer = { ...OWNER, phone: null, needs_onboarding: true };
    mockApi({
      '/auth/refresh': expired,
      '/auth/google': authOk(newcomer),
      'PATCH /me': (_url, init) => {
        saved = JSON.parse(String(init.body));
        return { status: 200, body: { ...OWNER, ...saved, needs_onboarding: false } };
      },
      '/admin/orders/summary': quietOrders,
      '/admin/dashboard': {
        status: 200,
        body: {
          today_orders: 0,
          today_revenue_paise: 0,
          status_counts: {},
          low_stock: [],
          recent_orders: [],
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));
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
      '/admin/dashboard': { status: 500, body: {} },
    });
    const router = renderApp('/sign-in');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('signs out from the sidebar', async () => {
    const fetchMock = mockApi({
      '/auth/refresh': authOk(),
      '/auth/logout': { status: 204 },
      '/admin/orders/summary': quietOrders,
      '/admin/dashboard': { status: 500, body: {} },
    });
    const router = renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Bada Bazar admin' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    const logout = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/logout'));
    expect(logout?.[1]).toMatchObject({ credentials: 'include' });
    // Otherwise Google's automatic sign-in would put them straight back in.
    expect(googleMocks.googleLogout).toHaveBeenCalled();
  });
});
