import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En desarrollo /api va a Fastify por el mismo origen: la cookie SameSite=Strict funciona igual que en producción.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
