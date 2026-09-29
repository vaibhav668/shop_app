/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Tests must not depend on a developer's local .env files.
    env: { VITE_API_URL: 'http://api.test/api/v1', VITE_SHOP_URL: 'http://localhost:8081' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
