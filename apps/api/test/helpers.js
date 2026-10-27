import { crearApp } from '../src/app.js';
import { cargarEnv } from '../src/config/env.js';

// Config válida mínima para pruebas que no tocan una base real.
const ENV_PRUEBA = {
  NODE_ENV: 'test',
  CORS_ORIGIN: 'http://localhost:5173',
  DB_HOST: 'localhost',
  DB_NAME: 'prueba',
  DB_USER: 'prueba',
  DB_PASSWORD: 'prueba',
};
export const configPrueba = cargarEnv(ENV_PRUEBA);

// Pool falso: cada prueba decide qué devuelve query().
export function poolFalso(query = async () => ({ rows: [] })) {
  return { query, end: async () => {} };
}

// `config` sobrescribe variables de entorno puntuales (como texto, igual que en .env).
export async function crearAppPrueba({ pool = poolFalso(), registrar, config } = {}) {
  const configFinal = config ? cargarEnv({ ...ENV_PRUEBA, ...config }) : configPrueba;
  return crearApp({ config: configFinal, pool, logger: false, registrar });
}
