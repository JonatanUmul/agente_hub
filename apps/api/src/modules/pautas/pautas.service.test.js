import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from './pautas.repository.js';
import { cambiarActivoPauta, crearPauta, editarPauta } from './pautas.service.js';

vi.mock('./pautas.repository.js');

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
const editable = {
  nombre: 'Promo',
  mensajeCliente: null,
  descuentoPct: 20,
  palabrasClave: [],
  vigenteDesde: '2026-11-01T06:00:00.000Z',
  vigenteHasta: null,
  activo: true,
  aplicaTodos: false,
  productoIds: [3],
  multimediaIds: [],
  version: 'v1',
};

beforeEach(() => {
  vi.resetAllMocks();
  repo.obtenerEditableBloqueando.mockResolvedValue(editable);
  repo.obtenerPorId.mockResolvedValue({ id: 1 });
  repo.productosNoAsignables.mockResolvedValue([]);
  repo.archivosNoAsignables.mockResolvedValue([]);
});

const editar = (cambios) =>
  editarPauta(db, { id: 1, datos: { ...editable, ...cambios }, correo: 'c@e.com' });

describe('editarPauta', () => {
  it('la misma fecha con otra zona horaria no cuenta como cambio', async () => {
    await editar({ vigenteDesde: '2026-11-01T00:00:00-06:00' });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('un cambio real de fecha sí se guarda', async () => {
    await editar({ vigenteHasta: '2026-12-01T06:00:00.000Z' });
    expect(repo.actualizar).toHaveBeenCalledOnce();
  });

  it('rechaza con 409 una versión vieja', async () => {
    await expect(editar({ version: 'v0' })).rejects.toMatchObject({ codigo: 'CONFLICTO_VERSION' });
  });

  it('traduce el CHECK de vigencia de la base a 400', async () => {
    repo.actualizar.mockRejectedValue(Object.assign(new Error('check'), { code: '23514' }));
    await expect(editar({ nombre: 'Otra' })).rejects.toMatchObject({ estadoHttp: 400 });
  });
});

describe('modelos y archivos', () => {
  it('quitar un modelo cuenta como cambio', async () => {
    await editar({ productoIds: [] });
    expect(repo.actualizar).toHaveBeenCalledOnce();
  });

  it('rechaza con 400 lo nuevo que no existe o está inactivo', async () => {
    repo.productosNoAsignables.mockResolvedValue([7]);
    repo.archivosNoAsignables.mockResolvedValue([20, 21]);
    await expect(editar({ productoIds: [3, 7], multimediaIds: [20, 21] })).rejects.toMatchObject({
      codigo: 'ASOCIADO_NO_VALIDO',
      estadoHttp: 400,
      message: expect.stringContaining('producto(s) 7 y archivo(s) 20, 21'),
    });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('con «todos los modelos» no valida los modelos', async () => {
    repo.productosNoAsignables.mockResolvedValue([7]);
    await editar({ aplicaTodos: true, productoIds: [3, 7] });
    expect(repo.productosNoAsignables).not.toHaveBeenCalled();
    expect(repo.actualizar).toHaveBeenCalledOnce();
  });
});

describe('cambiarActivoPauta', () => {
  it('solo cambia `activo`', async () => {
    await cambiarActivoPauta(db, { id: 1, activo: false, version: 'v1', correo: 'c@e.com' });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      1,
      { ...editable, activo: false },
      'c@e.com',
    );
  });
});

describe('crearPauta', () => {
  it('traduce código duplicado a 409 CODIGO_EN_USO', async () => {
    repo.insertar.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(crearPauta(db, { datos: {}, correo: 'c@e.com' })).rejects.toMatchObject({
      codigo: 'CODIGO_EN_USO',
      estadoHttp: 409,
    });
  });
});
