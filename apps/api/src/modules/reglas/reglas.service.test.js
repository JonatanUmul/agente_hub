import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from './reglas.repository.js';
import { cambiarActivoRegla, crearRegla, editarRegla } from './reglas.service.js';

vi.mock('./reglas.repository.js');

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const editable = {
  modulo: 'SAC',
  destino: 'TODOS',
  categoria: 'tono',
  titulo: 'T',
  regla: 'R',
  prioridad: 50,
  activo: true,
  vigenteDesde: null,
  vigenteHasta: null,
  version: 'v1',
};

beforeEach(() => {
  vi.resetAllMocks();
  repo.obtenerEditableBloqueando.mockResolvedValue(editable);
  repo.obtenerPorId.mockResolvedValue({ id: 1 });
});

describe('reglas', () => {
  it('traduce código duplicado a 409 CODIGO_EN_USO', async () => {
    repo.insertar.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(crearRegla(db, { datos: {}, correo: 'c@e.com' })).rejects.toMatchObject({
      codigo: 'CODIGO_EN_USO',
    });
  });

  it('desactivar guarda solo `activo` con el correo del usuario', async () => {
    await cambiarActivoRegla(db, { id: 1, activo: false, version: 'v1', correo: 'c@e.com' });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      1,
      { ...editable, activo: false },
      'c@e.com',
    );
  });

  it('desactivar una regla ya inactiva no escribe', async () => {
    repo.obtenerEditableBloqueando.mockResolvedValue({ ...editable, activo: false });
    await cambiarActivoRegla(db, { id: 1, activo: false, version: 'v1', correo: 'c@e.com' });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('el service rechaza ORQUESTADOR fuera de GLOBAL aunque llegue sin pasar por Zod', async () => {
    await expect(
      crearRegla(db, {
        datos: { ...editable, destino: 'ORQUESTADOR', modulo: 'SAC' },
        correo: 'c@e.com',
      }),
    ).rejects.toMatchObject({ codigo: 'ORQUESTADOR_SOLO_GLOBAL', estadoHttp: 400 });
    await expect(
      editarRegla(db, {
        id: 1,
        datos: { ...editable, destino: 'ORQUESTADOR', modulo: 'COMPRA' },
        correo: 'c@e.com',
      }),
    ).rejects.toMatchObject({ codigo: 'ORQUESTADOR_SOLO_GLOBAL' });
    expect(repo.insertar).not.toHaveBeenCalled();
    expect(repo.actualizar).not.toHaveBeenCalled();
  });
});
