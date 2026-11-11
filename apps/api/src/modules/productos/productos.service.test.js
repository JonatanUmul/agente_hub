import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPOS_FICHA } from '@ecofiltro/shared';
import * as repo from './productos.repository.js';
import {
  cambiarActivo,
  crearProducto,
  editarProducto,
  impactoCambioCodigo,
  listarProductos,
} from './productos.service.js';

vi.mock('./productos.repository.js');

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };

const fichaVacia = Object.fromEntries(
  CAMPOS_FICHA.map((c) => [c, c === 'caracteristicas' ? [] : null]),
);
const editable = {
  tipo: 'equipo',
  codigo: 'EQ-1',
  variante: null,
  nombreCorto: null,
  precioBase: 100,
  descuentoPct: 10,
  estado: 'disponible',
  colores: ['azul'],
  palabrasClave: [],
  pautaIds: [],
  orden: 100,
  activo: true,
  ...fichaVacia,
  version: 'v1',
};
const producto = { id: 1, precioBase: 100, descuentoVigentePct: 10, activo: true };

beforeEach(() => {
  vi.resetAllMocks();
  repo.obtenerEditableBloqueando.mockResolvedValue(editable);
  repo.obtenerPorId.mockResolvedValue(producto);
  repo.buscarCodigoEnUso.mockResolvedValue(null);
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
    await expect(editar({ pautaIds: [999] })).rejects.toMatchObject({
      codigo: 'PAUTA_INEXISTENTE',
    });
  });

  it('guarda cambios de la ficha', async () => {
    await editar({ caracteristicas: ['Fácil de limpiar'], anchoCm: 37.5 });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ caracteristicas: ['Fácil de limpiar'], anchoCm: 37.5 }),
      'ana@ejemplo.com',
    );
  });

  it('rechaza compatibilidad en un equipo y purificador en un accesorio', async () => {
    await expect(editar({ compatibleCon: 'Tonelito' })).rejects.toMatchObject({
      codigo: 'CAMPO_NO_APLICA',
      estadoHttp: 400,
    });
    repo.obtenerEditableBloqueando.mockResolvedValue({ ...editable, tipo: 'accesorio' });
    await expect(editar({ capacidadPurificadorLitros: 10 })).rejects.toMatchObject({
      codigo: 'CAMPO_NO_APLICA',
    });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('acepta compatibilidad y purificador en un repuesto', async () => {
    repo.obtenerEditableBloqueando.mockResolvedValue({ ...editable, tipo: 'repuesto' });
    await editar({ compatibleCon: 'Tonelito', capacidadPurificadorLitros: 1.5 });
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('responde 404 si el producto no existe', async () => {
    repo.obtenerEditableBloqueando.mockResolvedValue(null);
    await expect(editar({})).rejects.toMatchObject({ estadoHttp: 404 });
  });
});

describe('editarProducto: cambio de ItemCode', () => {
  it('exige la confirmación del paso de impacto', async () => {
    await expect(editar({ codigo: 'EQ-2' })).rejects.toMatchObject({
      codigo: 'CONFIRMAR_CAMBIO_CODIGO',
    });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('rechaza un código que ya usa otro producto y dice con cuál choca', async () => {
    repo.buscarCodigoEnUso.mockResolvedValue({
      id: 7,
      codigo: 'eq-2',
      nombre: 'Equipo viejo',
      activo: false,
    });
    await expect(editar({ codigo: 'EQ-2', confirmarCambioCodigo: true })).rejects.toMatchObject({
      codigo: 'CODIGO_DUPLICADO',
      estadoHttp: 409,
      message: 'El ItemCode EQ-2 ya lo usa «Equipo viejo» (ItemCode eq-2, inactivo)',
    });
    expect(repo.buscarCodigoEnUso).toHaveBeenCalledWith(expect.anything(), 'EQ-2', 1);
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('guarda el código nuevo si está libre y confirmado', async () => {
    await editar({ codigo: 'EQ-2', confirmarCambioCodigo: true });
    expect(repo.actualizar).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ codigo: 'EQ-2' }),
      'ana@ejemplo.com',
    );
  });

  it('un código viejo fuera de formato se guarda tal cual si no cambia', async () => {
    repo.obtenerEditableBloqueando.mockResolvedValue({ ...editable, codigo: 'cerámica' });
    await editar({ codigo: 'cerámica', precioBase: 1 });
    expect(repo.actualizar.mock.calls[0][2].codigo).toBe('cerámica');
  });

  it('el código nuevo se normaliza y se valida', async () => {
    await editar({ codigo: ' eq 2 ', confirmarCambioCodigo: true });
    expect(repo.actualizar.mock.calls[0][2].codigo).toBe('EQ2');
    await expect(editar({ codigo: 'EQ_2', confirmarCambioCodigo: true })).rejects.toMatchObject({
      codigo: 'ITEMCODE_NO_VALIDO',
    });
  });

  it('sin cambio de código no pide confirmación', async () => {
    await editar({ precioBase: 1 });
    expect(repo.buscarCodigoEnUso).not.toHaveBeenCalled();
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('traduce la UNIQUE de la base (dos personas a la vez) a 409', async () => {
    repo.actualizar.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(editar({ codigo: 'EQ-2', confirmarCambioCodigo: true })).rejects.toMatchObject({
      codigo: 'CODIGO_DUPLICADO',
    });
  });
});

describe('crearProducto', () => {
  const nuevo = { ...editable, nombre: 'Nuevo', familia: 'CERAMICA', capacidadLitros: null };
  delete nuevo.version;

  it('crea el producto con sus pautas y el correo del usuario', async () => {
    repo.crear.mockResolvedValue(9);
    await crearProducto(db, { datos: { ...nuevo, pautaIds: [3] }, correo: 'ana@ejemplo.com' });
    expect(repo.crear).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'ana@ejemplo.com',
    );
    expect(repo.guardarPautas).toHaveBeenCalledWith(expect.anything(), 9, [3], 'ana@ejemplo.com');
    expect(repo.obtenerPorId).toHaveBeenCalledWith(expect.anything(), 9);
  });

  it('rechaza un código repetido sin crear nada', async () => {
    repo.buscarCodigoEnUso.mockResolvedValue({ id: 2, codigo: 'EQ-1', nombre: 'X', activo: true });
    await expect(crearProducto(db, { datos: nuevo, correo: 'a@b.c' })).rejects.toMatchObject({
      codigo: 'CODIGO_DUPLICADO',
    });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('valida los campos por tipo con el tipo del formulario', async () => {
    await expect(
      crearProducto(db, { datos: { ...nuevo, compatibleCon: 'Tonelito' }, correo: 'a@b.c' }),
    ).rejects.toMatchObject({ codigo: 'CAMPO_NO_APLICA' });
  });
});

describe('impactoCambioCodigo', () => {
  it('cuenta dependencias y deja solo menciones de palabra completa del código viejo', async () => {
    repo.obtenerPorId.mockResolvedValue({ id: 1, codigo: 'LLAVE' });
    repo.contarDependencias.mockResolvedValue({
      multimedia: 5,
      productosPautas: 1,
      multimediaPautas: 2,
    });
    repo.buscarTextosConCodigo.mockResolvedValue([
      { tabla: 'eco_reglas_bot', id: 1, etiqueta: 'R1', activo: true, texto: '[[PRECIO:LLAVE]]' },
      { tabla: 'eco_mensajes', id: 2, etiqueta: 'M', activo: true, texto: 'Ver LLAVE-2' },
    ]);
    const impacto = await impactoCambioCodigo(db, { id: 1, codigo: 'LLAVE-X' });
    expect(repo.buscarCodigoEnUso).toHaveBeenCalledWith(db, 'LLAVE-X', 1);
    expect(impacto).toEqual({
      conflicto: null,
      dependencias: { multimedia: 5, productosPautas: 1, multimediaPautas: 2 },
      menciones: [{ tabla: 'eco_reglas_bot', id: 1, etiqueta: 'R1', activo: true }],
    });
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
