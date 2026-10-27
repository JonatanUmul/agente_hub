import { afterEach, describe, expect, it } from 'vitest';
import { crearAppPrueba, poolFalso } from '../../../test/helpers.js';

let app;
afterEach(() => app?.close());

describe('GET /api/salud', () => {
  it('responde 200 cuando la base contesta', async () => {
    app = await crearAppPrueba();
    const res = await app.inject({ url: '/api/salud' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ estado: 'ok', baseDatos: 'ok' });
  });

  it('responde 503 cuando la base no contesta', async () => {
    const pool = poolFalso(async () => {
      throw new Error('ECONNREFUSED');
    });
    app = await crearAppPrueba({ pool });
    const res = await app.inject({ url: '/api/salud' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ estado: 'degradado', baseDatos: 'sin_conexion' });
  });
});
