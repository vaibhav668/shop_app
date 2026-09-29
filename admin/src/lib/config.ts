// VITE_* values are bundled into the browser app: public identifiers only.
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(
  /\/$/,
  '',
);

/** The customer shop, whose Welcome screen is the one sign-in page for everyone. */
export const SHOP_URL: string = (import.meta.env.VITE_SHOP_URL ?? 'http://localhost:8081').replace(
  /\/$/,
  '',
);
