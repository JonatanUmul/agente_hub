import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Escucha en todas las interfaces: accesible desde otros equipos de la misma red wifi.
    host: true,
    // En desarrollo /api va a Fastify por el mismo origen: la cookie SameSite=Strict funciona igual que en producción.
    // API_URL permite apuntar a otra API (p. ej. una segunda copia local en otro puerto).
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3000' },
  },
});
