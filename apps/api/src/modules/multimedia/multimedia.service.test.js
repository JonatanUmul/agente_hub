import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from './multimedia.repository.js';
import { crearArchivo, editarArchivo } from './multimedia.service.js';

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
