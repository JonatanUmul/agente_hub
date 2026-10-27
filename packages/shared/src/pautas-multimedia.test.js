import { describe, expect, it } from 'vitest';
import { comoLoVeElBot, esquemaCrearArchivo } from './multimedia.js';
import { esquemaCrearPauta } from './pautas.js';

const pauta = {
  codigo: 'NAVIDAD',
  nombre: 'Navidad',
  mensajeCliente: '  ',
  descuentoPct: 15,
  palabrasClave: [],
  vigenteDesde: '2026-12-01T00:00:00-06:00',
  vigenteHasta: '2026-12-26T00:00:00-06:00',
  activo: true,
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
        pautaId: null,
        orden: 100,
        activo: true,
      }).success,
    ).toBe(false);
  });
});

describe('comoLoVeElBot (reglas de eco_contexto)', () => {
  it('imagen sin pauta → lista general', () => {
    expect(comoLoVeElBot({ tipo: 'imagen', activo: true, pautaId: null })).toMatchObject({
      visible: true,
      detalle: 'Aparece en: lista de multimedia',
    });
  });
  it('imagen con pauta → en ambos lugares', () => {
    expect(comoLoVeElBot({ tipo: 'imagen', activo: true, pautaId: 3 }).detalle).toContain(' y ');
  });
  it('promoción con pauta → solo en la pauta', () => {
    expect(comoLoVeElBot({ tipo: 'promocion', activo: true, pautaId: 3 })).toMatchObject({
      visible: true,
      detalle: 'Aparece en: imágenes de su pauta',
    });
  });
  it('promoción sin pauta → el bot no la ve', () => {
    expect(comoLoVeElBot({ tipo: 'promocion', activo: true, pautaId: null }).visible).toBe(false);
  });
  it('inactivo → el bot no lo ve', () => {
    expect(comoLoVeElBot({ tipo: 'imagen', activo: false, pautaId: null }).visible).toBe(false);
  });
});
