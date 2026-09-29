import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import WelcomeScreen from '@/app/welcome';

const mockSignInWithGoogle = jest.fn();

jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ signInWithGoogle: mockSignInWithGoogle }),
}));

const mockGetGoogleIdToken = jest.fn();
jest.mock('@/features/auth/googleSignIn', () => {
  const actual = jest.requireActual('@/features/auth/googleSignIn');
  return {
    ...actual,
    isGoogleSignInAvailable: true,
    getGoogleIdToken: () => mockGetGoogleIdToken(),
  };
});

beforeEach(() => {
  mockSignInWithGoogle.mockReset();
  mockGetGoogleIdToken.mockReset();
});

describe('Welcome screen', () => {
  it('offers only Continue with Google', async () => {
    await render(<WelcomeScreen />);
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
    expect(screen.queryByText(/email/i)).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(1);
  });

  it('signs in with the token Google returns', async () => {
    mockGetGoogleIdToken.mockResolvedValue('google-id-token');
    mockSignInWithGoogle.mockResolvedValue(undefined);
    await render(<WelcomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledWith('google-id-token'));
  });

  it('does nothing when the account picker is closed', async () => {
    mockGetGoogleIdToken.mockResolvedValue(null);
    await render(<WelcomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mockGetGoogleIdToken).toHaveBeenCalled());
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
  });

  it('shows the server message when sign-in is refused', async () => {
    mockGetGoogleIdToken.mockResolvedValue('google-id-token');
    mockSignInWithGoogle.mockRejectedValue(
      new ApiError('ACCOUNT_DISABLED', 'This account is disabled.', 403),
    );
    await render(<WelcomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByText('This account is disabled.')).toBeOnTheScreen();
  });
});
