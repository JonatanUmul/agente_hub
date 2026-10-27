import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import pluginAutenticacion from './plugins/autenticacion.js';
import pluginDb from './plugins/db.js';
import pluginErrores from './plugins/errores.js';
import pluginRateLimit from './plugins/rate-limit.js';
import pluginSeguridad from './plugins/seguridad.js';
import moduloAuth from './modules/auth/index.js';
import moduloConfiguracion from './modules/configuracion/index.js';
import moduloMultimedia from './modules/multimedia/index.js';
import moduloPautas from './modules/pautas/index.js';
import moduloPreguntas from './modules/preguntas/index.js';
import moduloProductos from './modules/productos/index.js';
import moduloReglas from './modules/reglas/index.js';
import moduloSalud from './modules/salud/index.js';
import moduloUsuarios from './modules/usuarios/index.js';

// Rutas de datos que nunca deben aparecer en los logs.
const CAMPOS_SENSIBLES = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
];

// Construye la app sin escuchar en un puerto: server.js la arranca y las pruebas usan app.inject().
// `registrar` permite a las pruebas añadir rutas bajo /api con los mismos plugins.
export async function crearApp({ config, pool, logger = true, registrar }) {
  const app = Fastify({
    logger: logger && {
      level: config.LOG_LEVEL,
      redact: { paths: CAMPOS_SENSIBLES, censor: '[oculto]' },
    },
    // Detrás del proxy: confiamos en X-Forwarded-For para la IP real (rate limit, auditoría).
    trustProxy: config.NODE_ENV === 'production',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('config', config);

  await app.register(pluginErrores);
  await app.register(pluginSeguridad, { corsOrigin: config.CORS_ORIGIN });
  await app.register(pluginRateLimit);
  await app.register(pluginDb, { pool });

  await app.register(
    async (api) => {
      await api.register(pluginAutenticacion);
      await api.register(moduloSalud);
      await api.register(moduloAuth);
      await api.register(moduloUsuarios);
      await api.register(moduloConfiguracion);
      await api.register(moduloPautas);
      await api.register(moduloProductos);
      await api.register(moduloMultimedia);
      await api.register(moduloReglas);
      await api.register(moduloPreguntas);
      if (registrar) await api.register(registrar);
    },
    { prefix: '/api' },
  );

  return app;
}
