import { defineConfig } from 'vitest/config';

// Integración: requieren el PostgreSQL de Docker levantado (npm run dev:db).
export default defineConfig({
  test: {
    include: ['test/integracion/**/*.test.js'],
    globalSetup: ['test/integracion/preparar.js'],
    fileParallelism: false,
  },
});
