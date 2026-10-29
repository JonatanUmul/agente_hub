import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAppPrueba } from '../../../test/helpers.js';
import { obtenerSesion } from '../auth/auth.service.js';
import * as repo from './mensajes.repository.js';
import {
  cambiarActivoMensaje,
  crearMensaje,
  editarMensaje,
  eliminarMensaje,
} from './mensajes.service.js';

vi.mock('./mensajes.repository.js');
vi.mock('../auth/auth.service.js', async (original) => ({
  ...(await original()),
  obtenerSesion: vi.fn(),
}));

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const correo = 'ana@e.com';
const tipo = (clave, extra = {}) => ({
  clave,
  categoria: 'Inactividad',
  titulo: clave,
  descripcion: null,
  comodines: ['minutos'],
  varias: true,
  orden: 10,
  ...extra,
});
const version = (id, clave, extra = {}) => ({
  id,
  clave,
  texto: `Texto ${id}`,
  activo: true,
  orden: id * 10,
  version: `v${id}`,
  ...extra,
});

let app;
beforeEach(() => vi.resetAllMocks());
afterEach(() => app?.close());

describe('servicio de mensajes', () => {
  it('crea con el correo y rechaza comodines que no son del tipo', async () => {
    repo.obtenerTipo.mockResolvedValue(tipo('inactividad_aviso'));
    repo.versionesBloqueando.mockResolvedValue([]);
    repo.insertar.mockResolvedValue(1);
    await crearMensaje(db, {
      datos: { clave: 'inactividad_aviso', texto: 'Cerramos en {minutos} min', activo: true },
      correo,
    });
    expect(repo.insertar).toHaveBeenCalledWith(expect.anything(), expect.anything(), correo);

    await expect(
      crearMensaje(db, {
        datos: { clave: 'inactividad_aviso', texto: 'Hola {nombre}', activo: true },
        correo,
      }),
    ).rejects.toMatchObject({ codigo: 'TEXTO_INVALIDO', estadoHttp: 400 });
  });

  it('texto repetido en la clave → 409', async () => {
    repo.obtenerTipo.mockResolvedValue(tipo('inactividad_cierre'));
    repo.versionesBloqueando.mockResolvedValue([]);
    repo.insertar.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(
      crearMensaje(db, {
        datos: { clave: 'inactividad_cierre', texto: 'Adiós', activo: true },
        correo,
      }),
    ).rejects.toMatchObject({ codigo: 'TEXTO_REPETIDO', estadoHttp: 409 });
  });

  it('un mensaje de un solo uso no admite dos versiones activas', async () => {
    repo.obtenerTipo.mockResolvedValue(tipo('asesor_asignado', { varias: false }));
    repo.versionesBloqueando.mockResolvedValue([version(1, 'asesor_asignado')]);
    await expect(
      crearMensaje(db, {
        datos: { clave: 'asesor_asignado', texto: 'Otro', activo: true },
        correo,
      }),
    ).rejects.toMatchObject({ codigo: 'UNA_SOLA_VERSION' });
  });

  describe('protección de la última versión', () => {
    const ultima = version(1, 'menu_bienvenida');
    beforeEach(() => {
      repo.obtenerPorId.mockResolvedValue(ultima);
      repo.obtenerTipo.mockResolvedValue(tipo('menu_bienvenida', { comodines: [] }));
      repo.versionesBloqueando.mockResolvedValue([ultima]);
    });

    it('desactivar la última de menu_bienvenida pide confirmar', async () => {
      await expect(
        cambiarActivoMensaje(db, { id: 1, activo: false, version: 'v1', confirmar: false, correo }),
      ).rejects.toMatchObject({ codigo: 'ULTIMA_VERSION', estadoHttp: 409 });
      expect(repo.actualizar).not.toHaveBeenCalled();
      await cambiarActivoMensaje(db, {
        id: 1,
        activo: false,
        version: 'v1',
        confirmar: true,
        correo,
      });
      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('eliminar la última pide confirmar', async () => {
      await expect(
        eliminarMensaje(db, { id: 1, version: 'v1', confirmar: false, correo }),
      ).rejects.toMatchObject({ codigo: 'ULTIMA_VERSION' });
      await eliminarMensaje(db, { id: 1, version: 'v1', confirmar: true, correo });
      expect(repo.eliminar).toHaveBeenCalledWith(expect.anything(), 1, correo);
    });

    it('una clave no protegida se puede dejar sin versiones', async () => {
      const otra = version(2, 'respuesta_vacia');
      repo.obtenerPorId.mockResolvedValue(otra);
      repo.obtenerTipo.mockResolvedValue(tipo('respuesta_vacia', { comodines: [] }));
      repo.versionesBloqueando.mockResolvedValue([otra]);
      await cambiarActivoMensaje(db, {
        id: 2,
        activo: false,
        version: 'v2',
        confirmar: false,
        correo,
      });
      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('version vieja → 409 de conflicto', async () => {
      await expect(
        editarMensaje(db, {
          id: 1,
          datos: { texto: 'Nuevo', activo: true, version: 'vieja', confirmar: false },
          correo,
        }),
      ).rejects.toMatchObject({ codigo: 'CONFLICTO_VERSION' });
    });
  });
});

describe('rutas de mensajes', () => {
  it('el rol comercial no puede editar mensajes', async () => {
    app = await crearAppPrueba();
    obtenerSesion.mockResolvedValue({
      usuario: { id: 1, correo, nombre: 'A', rol: 'comercial' },
      csrfToken: 't',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/mensajes',
      cookies: { eco_sesion: 'abc' },
      headers: { 'x-csrf-token': 't' },
      payload: { clave: 'menu_bienvenida', texto: 'Hola', activo: true },
    });
    expect(res.statusCode).toBe(403);
  });
});
