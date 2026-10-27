import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAppPrueba } from '../../../test/helpers.js';
import { obtenerSesion } from '../auth/auth.service.js';
import * as repo from './configuracion.repository.js';
import { cambiarInterruptor } from './configuracion.service.js';

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
