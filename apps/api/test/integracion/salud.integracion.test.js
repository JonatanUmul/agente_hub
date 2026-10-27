import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarEnv } from '../../src/config/env.js';
import { crearPool } from '../../src/db/pool.js';

// Corre contra el PostgreSQL de Docker (npm run dev:db) usando las variables de .env.
let app;
beforeAll(async () => {
  const config = cargarEnv();
  app = await crearApp({ config, pool: crearPool(config), logger: false });
});
afterAll(() => app?.close());

describe('integración: salud', () => {
  it('conecta a la base real', async () => {
    const res = await app.inject({ url: '/api/salud' });
    expect(res.json()).toMatchObject({ estado: 'ok', baseDatos: 'ok' });
  });
});
