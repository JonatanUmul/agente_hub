import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { AppError } from '../lib/app-error.js';

// Límite general generoso por IP. Rutas sensibles (login) declaran uno más estricto en `config.rateLimit`.
async function limite(app) {
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, contexto) =>
      new AppError({
        codigo: 'DEMASIADAS_SOLICITUDES',
        mensaje: `Demasiados intentos. Espera ${contexto.after} e inténtalo de nuevo.`,
        estadoHttp: 429,
      }),
  });
}

export default fp(limite, { name: 'rate-limit' });
