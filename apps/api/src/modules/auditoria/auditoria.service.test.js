import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from './auditoria.repository.js';
import {
  atribuir,
  buscarHistorial,
  calcularCambios,
  calcularEtiqueta,
} from './auditoria.service.js';

vi.mock('./auditoria.repository.js');
beforeEach(() => vi.resetAllMocks());

describe('calcularCambios', () => {
  it('en UPDATE devuelve solo lo distinto e ignora actualizado_en / actualizado_por', () => {
    const cambios = calcularCambios({
      operacion: 'UPDATE',
      antes: { precio_base: 100, colores: ['azul'], actualizado_en: 'a', actualizado_por: 'x' },
      despues: { precio_base: 120, colores: ['azul'], actualizado_en: 'b', actualizado_por: 'y' },
    });
    expect(cambios).toEqual([{ campo: 'precio_base', antes: 100, despues: 120 }]);
  });

  it('detecta cambios dentro de listas', () => {
    const cambios = calcularCambios({
      operacion: 'UPDATE',
      antes: { colores: ['azul'] },
      despues: { colores: ['azul', 'rojo'] },
    });
    expect(cambios).toHaveLength(1);
  });

  it('en INSERT devuelve todos los campos nuevos', () => {
    expect(
      calcularCambios({ operacion: 'INSERT', antes: null, despues: { nombre: 'A', activo: true } }),
    ).toEqual([
      { campo: 'nombre', antes: null, despues: 'A' },
      { campo: 'activo', antes: null, despues: true },
    ]);
  });
});

describe('calcularEtiqueta', () => {
  it('usa el nombre y agrega el código (ItemCode)', () => {
    expect(calcularEtiqueta({ despues: { nombre: 'Filtro', codigo: 'IT-1' } })).toBe(
      'Filtro (IT-1)',
    );
  });
  it('en configuración usa la clave', () => {
    expect(
      calcularEtiqueta({ despues: { clave: 'precios_habilitados', descripcion: 'Si es true…' } }),
    ).toBe('precios_habilitados');
  });
  it('en un DELETE usa la fila anterior', () => {
    expect(calcularEtiqueta({ antes: { titulo: 'Tono' }, despues: null })).toBe('Tono');
  });
});

describe('atribuir', () => {
  it('cambio de la app → la persona de actualizado_por', () => {
    expect(atribuir({ usuarioDb: 'eco_app', despues: { actualizado_por: 'ana@e.com' } })).toEqual({
      origen: 'app',
      usuarioApp: 'ana@e.com',
    });
  });
  it('cambio directo → no se atribuye aunque actualizado_por tenga un correo', () => {
    expect(atribuir({ usuarioDb: 'eco_admin', despues: { actualizado_por: 'ana@e.com' } })).toEqual(
      {
        origen: 'directo',
        usuarioApp: null,
      },
    );
  });
});

describe('buscarHistorial', () => {
  const fila = (id) => ({
    id,
    tabla: 'eco_productos',
    operacion: 'UPDATE',
    registroId: '1',
    antes: {},
    despues: {},
    usuarioDb: 'eco_app',
    creadoEn: '2026-10-27T00:00:00.000Z',
  });

  it('pide uno de más y devuelve el cursor de la página siguiente', async () => {
    repo.buscar.mockResolvedValue([fila(30), fila(20), fila(10)]);
    const r = await buscarHistorial({}, { limite: 2 });
    expect(r.entradas.map((e) => e.id)).toEqual([30, 20]);
    expect(r.siguiente).toBe(20);
  });

  it('sin más registros, siguiente es null', async () => {
    repo.buscar.mockResolvedValue([fila(30)]);
    expect((await buscarHistorial({}, { limite: 2 })).siguiente).toBeNull();
  });
});
