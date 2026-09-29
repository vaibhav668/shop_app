// VITE_* values are bundled into the browser app: public identifiers only.
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(
  /\/$/,
  '',
);

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/** The customer shop. Someone who isn't an admin but signs in here is sent there. */
export const SHOP_URL: string = (import.meta.env.VITE_SHOP_URL ?? 'http://localhost:8081').replace(
  /\/$/,
  '',
);
