import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

/** The Google ID token the stand-in button "returns"; tests mock POST /auth/google. */
export const TEST_GOOGLE_CREDENTIAL = 'test-google-id-token';

// Google's real button loads a script from Google. Tests use a plain button that behaves like
// a successful Google sign-in.
export const googleMocks = { oneTapLogin: vi.fn(), googleLogout: vi.fn() };

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => children,
  useGoogleOneTapLogin: (options: unknown) => googleMocks.oneTapLogin(options),
  googleLogout: () => googleMocks.googleLogout(),
  GoogleLogin: ({ onSuccess }: { onSuccess: (r: { credential: string }) => void }) =>
    createElement(
      'button',
      { type: 'button', onClick: () => onSuccess({ credential: TEST_GOOGLE_CREDENTIAL }) },
      'Continue with Google',
    ),
}));
