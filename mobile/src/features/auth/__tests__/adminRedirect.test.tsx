import { render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { AdminRedirect, adminHandoffUrl } from '@/features/auth/AdminRedirect';

const mockForgetSession = jest.fn();
jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ forgetSession: mockForgetSession, signOut: jest.fn() }),
}));

beforeEach(() => {
  mockForgetSession.mockReset().mockResolvedValue(undefined);
  jest.restoreAllMocks();
});

describe('AdminRedirect', () => {
  it('builds the dashboard link with the one-time code', () => {
    expect(adminHandoffUrl('a/b+c')).toBe('http://localhost:5173/sign-in?handoff=a%2Fb%2Bc');
  });

  it('hands the admin into the dashboard, then forgets the shop session', async () => {
    jest.spyOn(authApi, 'adminHandoff').mockResolvedValue({ code: 'code-123', expires_in: 60 });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    await render(<AdminRedirect />);

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('http://localhost:5173/sign-in?handoff=code-123'),
    );
    await waitFor(() => expect(mockForgetSession).toHaveBeenCalled());
    expect(authApi.adminHandoff).toHaveBeenCalledTimes(1);
  });

  it('explains a failure and keeps the session', async () => {
    jest
      .spyOn(authApi, 'adminHandoff')
      .mockRejectedValue(new ApiError('FORBIDDEN', 'Admins only.', 403));
    await render(<AdminRedirect />);

    expect(await screen.findByText('Admins only.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(mockForgetSession).not.toHaveBeenCalled();
  });
});
