import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAppPrueba } from '../../../test/helpers.js';
import { obtenerSesion } from '../auth/auth.service.js';
import * as repo from './frases.repository.js';
import {
  cambiarActivoFrase,
  crearFrase,
  eliminarFrase,
  listarFrases,
  reordenarFrases,
} from './frases.service.js';

vi.mock('./frases.repository.js');
vi.mock('../auth/auth.service.js', async (original) => ({
  ...(await original()),
  obtenerSesion: vi.fn(),
}));

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const correo = 'ana@ejemplo.com';
const editable = {
  modulo: 'GLOBAL',
  situacion: 'general',
  frase: '¿Algo más? 😊',
  activo: true,
  version: 'v1',
};

let app;
beforeEach(() => vi.resetAllMocks());
afterEach(() => app?.close());

describe('servicio de frases', () => {
  it('traduce una frase repetida a 409', async () => {
    repo.insertar.mockRejectedValue(Object.assign(new Error('unique'), { code: '23505' }));
    await expect(
      crearFrase(db, { datos: { ...editable, version: undefined }, correo }),
    ).rejects.toMatchObject({ codigo: 'FRASE_REPETIDA', estadoHttp: 409 });
  });

  it('convierte el filtro activo de texto a booleano', async () => {
    repo.listar.mockResolvedValue([]);
    await listarFrases(db, { activo: 'false' });
    expect(repo.listar).toHaveBeenCalledWith(db, { modulo: null, situacion: null, activo: false });
  });

  it('activar/desactivar solo cambia `activo`', async () => {
    repo.obtenerEditableBloqueando.mockResolvedValue(editable);
    await cambiarActivoFrase(db, { id: 1, activo: false, version: 'v1', correo });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      1,
      { ...editable, activo: false },
      correo,
    );
  });

  it('no borra si otra persona cambió la frase', async () => {
    repo.obtenerEditableBloqueando.mockResolvedValue(editable);
    await expect(eliminarFrase(db, { id: 1, version: 'vieja', correo })).rejects.toMatchObject({
      estadoHttp: 409,
    });
    expect(repo.eliminar).not.toHaveBeenCalled();
  });

  it('reordena solo las que cambian', async () => {
    repo.gruposBloqueando.mockResolvedValue([
      { id: 1, modulo: 'SAC', situacion: 'general', orden: 10 },
      { id: 2, modulo: 'SAC', situacion: 'general', orden: 20 },
    ]);
    repo.listar.mockResolvedValue([]);
    await reordenarFrases(db, {
      lista: [
        { id: 2, orden: 10 },
        { id: 1, orden: 10 },
      ],
      correo,
    });
    expect(repo.cambiarOrden).toHaveBeenCalledTimes(1);
    expect(repo.cambiarOrden).toHaveBeenCalledWith(expect.anything(), 2, 10, correo);
  });

  it('no mezcla grupos al reordenar', async () => {
    repo.gruposBloqueando.mockResolvedValue([
      { id: 1, modulo: 'SAC', situacion: 'general', orden: 10 },
      { id: 2, modulo: 'COMPRA', situacion: 'general', orden: 20 },
    ]);
    await expect(
      reordenarFrases(db, {
        lista: [
          { id: 1, orden: 10 },
          { id: 2, orden: 20 },
        ],
        correo,
      }),
    ).rejects.toMatchObject({ codigo: 'GRUPOS_DISTINTOS' });
    expect(repo.cambiarOrden).not.toHaveBeenCalled();
  });
});

describe('rutas de frases', () => {
  const pedir = (rol, opciones) => {
    obtenerSesion.mockResolvedValue({
      usuario: { id: 1, correo, nombre: 'Ana', rol },
      csrfToken: 't',
    });
    return app.inject({
      cookies: { eco_sesion: 'abc' },
      headers: { 'x-csrf-token': 't' },
      ...opciones,
    });
  };
  const crear = (rol, frase) =>
    pedir(rol, {
      method: 'POST',
      url: '/api/frases-cierre',
      payload: { modulo: 'GLOBAL', situacion: 'general', frase, activo: true },
    });

  it.each([
    ['muy corta', 'Ok'],
    ['más de 200 caracteres', 'a'.repeat(201)],
    ['con negrita Markdown', '¿**Algo** más?'],
    ['con #', '¿Algo más? #ayuda'],
    ['de dos líneas', '¿Algo más?\n😊'],
  ])('rechaza una frase %s', async (_caso, frase) => {
    app = await crearAppPrueba();
    expect((await crear('admin', frase)).statusCode).toBe(400);
    expect(repo.insertar).not.toHaveBeenCalled();
  });

  it('el rol comercial no puede crear frases', async () => {
    app = await crearAppPrueba();
    expect((await crear('comercial', '¿Algo más? 😊')).statusCode).toBe(403);
  });

  it('rechaza un módulo o una situación inventados', async () => {
    app = await crearAppPrueba();
    const res = await pedir('admin', {
      method: 'POST',
      url: '/api/frases-cierre',
      payload: { modulo: 'PAUTAS', situacion: 'despedida', frase: '¿Algo más?', activo: true },
    });
    expect(res.statusCode).toBe(400);
  });
});
