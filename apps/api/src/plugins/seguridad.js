import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

async function seguridad(app, { corsOrigin }) {
  await app.register(helmet);

  // Solo el dominio de la app puede llamar a la API con credenciales (cookies de sesión).
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
}

export default fp(seguridad, { name: 'seguridad' });
