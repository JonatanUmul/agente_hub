import { describe, expect, it } from 'vitest';
import { comoLoVeElBot, esquemaCrearArchivo } from './multimedia.js';
import { conSeleccion, loQueRecibeElCliente, principalTrasCambio } from './artePauta.js';
import { esquemaCrearPauta, otrasPautasConDescuento } from './pautas.js';

const pauta = {
  codigo: 'NAVIDAD',
  nombre: 'Navidad',
  mensajeCliente: '  ',
  descuentoPct: 15,
  palabrasClave: [],
  vigenteDesde: '2026-12-01T00:00:00-06:00',
  vigenteHasta: '2026-12-26T00:00:00-06:00',
  activo: true,
  aplicaTodos: false,
  productoIds: [],
  multimediaIds: [],
};

describe('esquemaCrearPauta', () => {
  it('acepta una vigencia válida y convierte texto vacío en null', () => {
    expect(esquemaCrearPauta.parse(pauta).mensajeCliente).toBeNull();
  });

  it('rechaza "hasta" anterior o igual a "desde" (mismo CHECK que la base)', () => {
    const r = esquemaCrearPauta.safeParse({ ...pauta, vigenteHasta: pauta.vigenteDesde });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path).toEqual(['vigenteHasta']);
  });

  it('permite vigencia abierta y descuento nulo', () => {
    expect(
      esquemaCrearPauta.safeParse({ ...pauta, vigenteHasta: null, descuentoPct: null }).success,
    ).toBe(true);
  });
});

describe('modelos y archivos de la pauta', () => {
  it('ids sin repetidos, ordenados y máximo 50', () => {
    expect(esquemaCrearPauta.parse({ ...pauta, productoIds: [5, 2, 5] }).productoIds).toEqual([
      2, 5,
    ]);
    const muchos = Array.from({ length: 51 }, (_, i) => i + 1);
    expect(esquemaCrearPauta.safeParse({ ...pauta, multimediaIds: muchos }).success).toBe(false);
    expect(esquemaCrearPauta.safeParse({ ...pauta, productoIds: [0] }).success).toBe(false);
  });

  it('avisa de otras pautas vigentes con descuento, no de la propia ni de las sin descuento', () => {
    const producto = {
      pautas: [
        { id: 1, nombre: 'Esta', vigente: true, descuentoPct: 10 },
        { id: 2, nombre: 'Navidad', vigente: true, descuentoPct: 15 },
        { id: 3, nombre: 'Vencida', vigente: false, descuentoPct: 20 },
        { id: 4, nombre: 'Visa', vigente: true, descuentoPct: null },
      ],
    };
    expect(otrasPautasConDescuento(producto, 1).map((p) => p.nombre)).toEqual(['Navidad']);
  });
});

describe('pauta principal de un archivo', () => {
  const archivo = (pautaIdPrincipal, pautas) => ({
    pautaIdPrincipal,
    pautas: pautas.map((id) => ({ id })),
  });

  it('al agregarlo: toma esta pauta solo si no tenía principal', () => {
    expect(principalTrasCambio(archivo(null, []), 5, true)).toBe(5);
    expect(principalTrasCambio(archivo(2, [2]), 5, true)).toBe(2);
  });

  it('al quitarlo: si era esta, pasa a la de menor id o a null', () => {
    expect(principalTrasCambio(archivo(5, [9, 5, 3]), 5, false)).toBe(3);
    expect(principalTrasCambio(archivo(5, [5]), 5, false)).toBeNull();
    expect(principalTrasCambio(archivo(2, [2]), 5, false)).toBe(2);
  });

  it('la vista previa usa la selección: con arte envía solo artes', () => {
    const base = { tipo: 'imagen', activo: true, orden: 0 };
    const archivos = [
      { ...base, id: 1, producto: { id: 1 }, pautaIdPrincipal: null, pautas: [] },
      { ...base, id: 2, producto: null, pautaIdPrincipal: null, pautas: [] },
    ];
    const fotos = loQueRecibeElCliente(conSeleccion(archivos, 7, [1]), 7, 3);
    expect(fotos).toMatchObject({ conArte: false, imagenes: [{ id: 1 }] });
    const arte = loQueRecibeElCliente(conSeleccion(archivos, 7, [1, 2]), 7, 3);
    expect(arte).toMatchObject({ conArte: true, imagenes: [{ id: 2 }] });
  });
});

describe('esquemaCrearArchivo', () => {
  it('rechaza un tipo que la base no permite', () => {
    expect(
      esquemaCrearArchivo.safeParse({
        tipo: 'audio',
        hubspotFileId: '1',
        descripcion: 'x',
        productoId: null,
        color: null,
        tema: null,
        pautaIds: [],
        orden: 100,
        activo: true,
      }).success,
    ).toBe(false);
  });
});

describe('comoLoVeElBot (reglas de eco_contexto)', () => {
  it('imagen sin pauta → lista general', () => {
    expect(comoLoVeElBot({ tipo: 'imagen', activo: true, pautaIds: [] })).toMatchObject({
      visible: true,
      detalle: 'Aparece en: lista de multimedia',
    });
  });
  it('imagen con pauta → en ambos lugares', () => {
    expect(comoLoVeElBot({ tipo: 'imagen', activo: true, pautaIds: [3] }).detalle).toContain(' y ');
  });
  it('promoción con pauta → solo en la pauta', () => {
    expect(comoLoVeElBot({ tipo: 'promocion', activo: true, pautaIds: [3] })).toMatchObject({
      visible: true,
      detalle: 'Aparece en: imágenes de su pauta',
    });
  });
  it('con varias pautas lo indica', () => {
    expect(comoLoVeElBot({ tipo: 'promocion', activo: true, pautaIds: [3, 4] }).detalle).toBe(
      'Aparece en: imágenes de sus 2 pautas',
    );
  });
  it('promoción sin pauta → el bot no la ve', () => {
    expect(comoLoVeElBot({ tipo: 'promocion', activo: true, pautaIds: [] }).visible).toBe(false);
  });
  it('inactivo → el bot no lo ve', () => {
    expect(comoLoVeElBot({ tipo: 'imagen', activo: false, pautaIds: [] }).visible).toBe(false);
  });
});
