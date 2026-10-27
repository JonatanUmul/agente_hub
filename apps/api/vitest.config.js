import { defineConfig } from 'vitest/config';

// Unitarias: rápidas, sin base de datos.
export default defineConfig({
  test: { include: ['src/**/*.test.js'] },
});
