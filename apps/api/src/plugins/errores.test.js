import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../lib/app-error.js';
import { crearAppPrueba } from '../../test/helpers.js';

let app;
afterEach(() => app?.close());

// Rutas de prueba (públicas, para no depender de la sesión) que provocan cada tipo de error.
const publica = { config: { publica: true } };
function registrar(api) {
  api.get('/negocio', publica, async () => {
    throw new AppError({ codigo: 'DESCUENTO_INVALIDO', mensaje: 'Máximo 100%', estadoHttp: 422 });
  });
  api.post(
    '/validar',
    { ...publica, schema: { body: z.object({ precio: z.number() }) } },
    async () => ({}),
  );
  api.get('/inesperado', publica, async () => {
    throw new Error('detalle interno con datos sensibles');
  });
}

describe('manejador central de errores', () => {
  it('traduce AppError a su estado y código', async () => {
    app = await crearAppPrueba({ registrar });
    const res = await app.inject({ url: '/api/negocio' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: { codigo: 'DESCUENTO_INVALIDO', mensaje: 'Máximo 100%' } });
  });

  it('devuelve 400 VALIDACION con el campo que falló', async () => {
    app = await crearAppPrueba({ registrar });
    const res = await app.inject({ method: 'POST', url: '/api/validar', payload: { precio: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.codigo).toBe('VALIDACION');
    expect(res.json().error.detalles[0].campo).toBe('precio');
  });

  it('oculta el detalle de errores inesperados', async () => {
    app = await crearAppPrueba({ registrar });
    const res = await app.inject({ url: '/api/inesperado' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('sensibles');
  });

  it('responde 404 con el mismo formato', async () => {
    app = await crearAppPrueba();
    const res = await app.inject({ url: '/api/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.codigo).toBe('RUTA_NO_ENCONTRADA');
  });

  it('agrega cabeceras de seguridad', async () => {
    app = await crearAppPrueba();
    const res = await app.inject({ url: '/api/no-existe' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
