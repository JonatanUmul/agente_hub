import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from './multimedia.repository.js';
import { crearArchivo, crearArtePauta, editarArchivo } from './multimedia.service.js';

vi.mock('./multimedia.repository.js');

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const editable = {
  descripcion: 'Foto',
  productoId: 1,
  color: 'azul',
  tema: null,
  pautaIds: [],
  orden: 100,
  activo: true,
  version: 'v1',
};

beforeEach(() => {
  vi.resetAllMocks();
  repo.obtenerEditableBloqueando.mockResolvedValue(editable);
  repo.obtenerPorId.mockResolvedValue({ id: 1 });
});

describe('multimedia', () => {
  it('traduce tipo + ID de HubSpot duplicado a 409', async () => {
    repo.insertar.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(crearArchivo(db, { datos: {}, correo: 'c@e.com' })).rejects.toMatchObject({
      codigo: 'ARCHIVO_DUPLICADO',
      estadoHttp: 409,
    });
  });

  it('traduce producto o pauta inexistente a 400', async () => {
    repo.actualizar.mockRejectedValue(Object.assign(new Error('fk'), { code: '23503' }));
    await expect(
      editarArchivo(db, { id: 1, datos: { ...editable, pautaIds: [999] }, correo: 'c@e.com' }),
    ).rejects.toMatchObject({ codigo: 'REFERENCIA_INEXISTENTE' });
  });

  it('guarda con el correo del usuario', async () => {
    await editarArchivo(db, { id: 1, datos: { ...editable, color: 'rojo' }, correo: 'c@e.com' });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ color: 'rojo' }),
      'c@e.com',
    );
  });
});

describe('arte de la pauta', () => {
  const arte = { ...editable, productoId: null, pautaIds: [5], orden: 30 };
  const datos = (reemplaza = null) => ({
    pautaId: 5,
    hubspotFileId: 'H-1',
    descripcion: 'Arte 15% de descuento',
    reemplaza,
  });

  it('se guarda como imagen sin producto, solo en esa pauta y al final de sus imágenes', async () => {
    repo.insertar.mockResolvedValue(9);
    repo.siguienteOrdenDePauta.mockResolvedValue(40);
    await crearArtePauta(db, { datos: datos(), correo: 'c@e.com' });
    expect(repo.insertar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tipo: 'imagen',
        productoId: null,
        pautaIds: [5],
        orden: 40,
        activo: true,
      }),
      'c@e.com',
    );
  });

  it('al reemplazar desactiva el anterior y el nuevo toma su orden', async () => {
    repo.obtenerEditableBloqueando.mockResolvedValue(arte);
    repo.insertar.mockResolvedValue(9);
    await crearArtePauta(db, { datos: datos({ id: 3, version: 'v1' }), correo: 'c@e.com' });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      3,
      { ...arte, activo: false },
      'c@e.com',
    );
    expect(repo.insertar.mock.calls[0][1]).toMatchObject({ orden: 30 });
  });

  it('no reemplaza una foto de producto ni una versión vieja', async () => {
    await expect(
      crearArtePauta(db, { datos: datos({ id: 3, version: 'v1' }), correo: 'c@e.com' }),
    ).rejects.toMatchObject({ codigo: 'NO_ES_ARTE_DE_LA_PAUTA' });
    repo.obtenerEditableBloqueando.mockResolvedValue(arte);
    await expect(
      crearArtePauta(db, { datos: datos({ id: 3, version: 'vieja' }), correo: 'c@e.com' }),
    ).rejects.toMatchObject({ estadoHttp: 409 });
    expect(repo.insertar).not.toHaveBeenCalled();
  });
});
