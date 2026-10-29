import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAppPrueba } from '../../../test/helpers.js';
import { obtenerSesion } from '../auth/auth.service.js';
import * as repo from './configuracion.repository.js';
import { cambiarInterruptor, cambiarParametro } from './configuracion.service.js';

vi.mock('./configuracion.repository.js');
vi.mock('../auth/auth.service.js', async (original) => ({
  ...(await original()),
  obtenerSesion: vi.fn(),
}));

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
let app;
beforeEach(() => vi.resetAllMocks());
afterEach(() => app?.close());

describe('cambiarInterruptor', () => {
  it('guarda el valor con el correo del usuario', async () => {
    repo.actualizarBooleano.mockResolvedValue({ clave: 'precios_habilitados', habilitado: true });
    await cambiarInterruptor(db, {
      clave: 'precios_habilitados',
      habilitado: true,
      correo: 'c@e.com',
    });
    expect(repo.actualizarBooleano).toHaveBeenCalledWith(expect.anything(), {
      clave: 'precios_habilitados',
      valor: true,
      actualizadoPor: 'c@e.com',
    });
  });

  it('responde 404 si la clave no existe en la base (no la crea)', async () => {
    repo.actualizarBooleano.mockResolvedValue(null);
    await expect(
      cambiarInterruptor(db, { clave: 'precios_habilitados', habilitado: true, correo: 'c@e.com' }),
    ).rejects.toMatchObject({ estadoHttp: 404 });
  });
});

describe('PUT /api/configuracion/interruptores/:clave', () => {
  const pedir = (clave, rol) => {
    obtenerSesion.mockResolvedValue({
      usuario: { id: 1, correo: 'x@e.com', nombre: 'X', rol },
      csrfToken: 't',
    });
    return app.inject({
      method: 'PUT',
      url: `/api/configuracion/interruptores/${clave}`,
      cookies: { eco_sesion: 'abc' },
      headers: { 'x-csrf-token': 't' },
      payload: { habilitado: true },
    });
  };

  it('rechaza claves que no son interruptores (ej. parámetros de n8n)', async () => {
    app = await crearAppPrueba();
    const res = await pedir('hubspot_sender_actor_id', 'admin');
    expect(res.statusCode).toBe(400);
  });

  it('el rol contenido no puede cambiar interruptores', async () => {
    app = await crearAppPrueba();
    expect((await pedir('precios_habilitados', 'contenido')).statusCode).toBe(403);
  });
});

describe('parámetros enteros', () => {
  const actual = (valor) => ({ clave: 'max_fotos_pauta', valor, version: 'v1' });

  it.each([
    ['segundos_agrupar_mensajes', 21],
    ['segundos_agrupar_mensajes', -1],
    ['max_fotos_pauta', 11],
    ['max_fotos_pauta', 1.5],
  ])('rechaza %s = %s', async (clave, valor) => {
    await expect(
      cambiarParametro(db, { clave, valor, version: 'v1', correo: 'c@e.com' }),
    ).rejects.toMatchObject({ codigo: 'VALOR_FUERA_DE_RANGO', estadoHttp: 400 });
    expect(repo.actualizarParametro).not.toHaveBeenCalled();
  });

  it('guarda un valor válido con el correo y no escribe si no cambia', async () => {
    repo.listarParametros.mockResolvedValue([actual(1)]);
    await cambiarParametro(db, {
      clave: 'max_fotos_pauta',
      valor: 2,
      version: 'v1',
      correo: 'c@e.com',
    });
    expect(repo.actualizarParametro).toHaveBeenCalledWith(expect.anything(), {
      clave: 'max_fotos_pauta',
      valor: 2,
      actualizadoPor: 'c@e.com',
    });
    repo.actualizarParametro.mockClear();
    await cambiarParametro(db, {
      clave: 'max_fotos_pauta',
      valor: 1,
      version: 'v1',
      correo: 'c@e.com',
    });
    expect(repo.actualizarParametro).not.toHaveBeenCalled();
  });

  it('responde 409 si otra persona lo cambió', async () => {
    repo.listarParametros.mockResolvedValue([actual(1)]);
    await expect(
      cambiarParametro(db, {
        clave: 'max_fotos_pauta',
        valor: 2,
        version: 'vieja',
        correo: 'c@e.com',
      }),
    ).rejects.toMatchObject({ estadoHttp: 409 });
  });

  it('la ruta rechaza claves que no son parámetros editables', async () => {
    app = await crearAppPrueba();
    obtenerSesion.mockResolvedValue({
      usuario: { id: 1, correo: 'x@e.com', nombre: 'X', rol: 'admin' },
      csrfToken: 't',
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/configuracion/parametros/moneda',
      cookies: { eco_sesion: 'abc' },
      headers: { 'x-csrf-token': 't' },
      payload: { valor: 1, version: 'v1' },
    });
    expect(res.statusCode).toBe(400);
  });
});
