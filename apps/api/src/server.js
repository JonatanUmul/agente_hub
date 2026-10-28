import { crearApp } from './app.js';
import { cargarEnv } from './config/env.js';
import { crearPool, crearPoolReportes } from './db/pool.js';

const config = cargarEnv();
const pool = crearPool(config);
const app = await crearApp({ config, pool, poolReportes: crearPoolReportes(config) });

// Cierre ordenado: termina peticiones en curso y libera conexiones antes de salir.
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.once(senal, async () => {
    app.log.info(`Recibido ${senal}, cerrando...`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
