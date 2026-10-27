import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from './productos.repository.js';
import { cambiarActivo, editarProducto, listarProductos } from './productos.service.js';

vi.mock('./productos.repository.js');

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };

const editable = {
  precioBase: 100,
  descuentoPct: 10,
  estado: 'disponible',
  colores: ['azul'],
  palabrasClave: [],
  pautaId: null,
  orden: 100,
  activo: true,
  version: 'v1',
};
const producto = { id: 1, precioBase: 100, descuentoVigentePct: 10, activo: true };

beforeEach(() => {
  vi.resetAllMocks();
  repo.obtenerEditableBloqueando.mockResolvedValue(editable);
  repo.obtenerPorId.mockResolvedValue(producto);
});

const editar = (cambios) =>
  editarProducto(db, { id: 1, datos: { ...editable, ...cambios }, correo: 'ana@ejemplo.com' });

describe('editarProducto', () => {
  it('guarda con el correo del usuario y devuelve el precio final', async () => {
    const resultado = await editar({ precioBase: 250 });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ precioBase: 250 }),
      'ana@ejemplo.com',
    );
    expect(resultado.precioFinal).toBe(90);
  });

  it('rechaza con 409 si otra persona guardó antes', async () => {
    await expect(editar({ version: 'vieja' })).rejects.toMatchObject({
      codigo: 'CONFLICTO_VERSION',
      estadoHttp: 409,
    });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('no escribe si no hay cambios', async () => {
    await editar({});
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('detecta cambios dentro de listas', async () => {
    await editar({ colores: ['azul', 'rojo'] });
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('traduce una pauta inexistente a 400', async () => {
    repo.actualizar.mockRejectedValue(Object.assign(new Error('fk'), { code: '23503' }));
    await expect(editar({ pautaId: 999 })).rejects.toMatchObject({ codigo: 'PAUTA_INEXISTENTE' });
  });

  it('responde 404 si el producto no existe', async () => {
    repo.obtenerEditableBloqueando.mockResolvedValue(null);
    await expect(editar({})).rejects.toMatchObject({ estadoHttp: 404 });
  });
});

describe('cambiarActivo', () => {
  it('solo cambia `activo` y conserva el resto', async () => {
    await cambiarActivo(db, { id: 1, activo: false, version: 'v1', correo: 'x@ejemplo.com' });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      1,
      { ...editable, activo: false },
      'x@ejemplo.com',
    );
  });
});

describe('listarProductos', () => {
  it('no calcula precio final para productos inactivos', async () => {
    repo.listar.mockResolvedValue([{ id: 2, precioBase: 100, descuentoVigentePct: null }]);
    expect((await listarProductos(db))[0].precioFinal).toBeNull();
  });
});
