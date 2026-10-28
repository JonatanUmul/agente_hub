import { describe, expect, it } from 'vitest';
import {
  ahoraEnGuatemala,
  candidatosSaludo,
  choquesDeSaludo,
  esquemaCrearSaludo,
  momentoDelDia,
  proximaTemporada,
  resolverSaludo,
  tieneSaludoBase,
  vigenciaLegible,
  vigenteEn,
} from './saludos.js';

let siguienteId = 1;
const s = (nombre, extra = {}) => ({
  id: siguienteId++,
  nombre,
  modulo: 'GLOBAL',
  saludo: `${nombre} {momento}`,
  fechaInicio: null,
  fechaFin: null,
  repetirAnual: false,
  prioridad: 0,
  activo: true,
  ...extra,
});
const normal = s('Normal');
const navidad = s('Navidad', {
  fechaInicio: '2026-12-15',
  fechaFin: '2026-12-26',
  repetirAnual: true,
  prioridad: 10,
});
const anioNuevo = s('Año Nuevo', {
  fechaInicio: '2026-12-31',
  fechaFin: '2027-01-03',
  repetirAnual: true,
  prioridad: 10,
});
const campania = s('Campaña', {
  modulo: 'COMPRA',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-03',
  prioridad: 10,
});
const todos = [normal, navidad, anioNuevo, campania];
const nombres = (modulo, dia) => candidatosSaludo(todos, modulo, dia).map((x) => x.nombre);

describe('simulación (misma lógica que eco_saludo)', () => {
  it('Navidad gana al normal cada año', () => {
    expect(nombres('MENU', '2026-12-24')).toEqual(['Navidad']);
    expect(nombres('MENU', '2031-12-24')).toEqual(['Navidad']);
    expect(nombres('MENU', '2026-12-27')).toEqual(['Normal']);
  });

  it('Año Nuevo cruza de diciembre a enero', () => {
    expect(nombres('SAC', '2026-12-31')).toEqual(['Año Nuevo']);
    expect(nombres('SAC', '2028-01-02')).toEqual(['Año Nuevo']);
    expect(nombres('SAC', '2028-01-04')).toEqual(['Normal']);
    expect(nombres('SAC', '2027-12-30')).toEqual(['Normal']);
  });

  it('una campaña con fechas exactas solo aplica a su módulo y ese año', () => {
    expect(nombres('COMPRA', '2026-11-02')).toEqual(['Campaña']);
    expect(nombres('SAC', '2026-11-02')).toEqual(['Normal']);
    expect(nombres('COMPRA', '2027-11-02')).toEqual(['Normal']);
  });

  it('a igual prioridad, el del módulo gana a GLOBAL; si siguen empatados, devuelve todos', () => {
    const propio = s('Propio', { modulo: 'SAC' });
    expect(candidatosSaludo([normal, propio], 'SAC', '2026-05-01').map((x) => x.nombre)).toEqual([
      'Propio',
    ]);
    const otro = s('Otro');
    expect(candidatosSaludo([normal, otro], 'SAC', '2026-05-01')).toHaveLength(2);
  });

  it('ignora inactivos y no devuelve nada si no hay saludo', () => {
    expect(candidatosSaludo([{ ...normal, activo: false }], 'MENU', '2026-05-01')).toEqual([]);
  });

  it('{momento} cambia según la hora', () => {
    expect(momentoDelDia('04:59')).toBe('Buenas noches');
    expect(momentoDelDia('05:00')).toBe('Buenos días');
    expect(momentoDelDia('11:59')).toBe('Buenos días');
    expect(momentoDelDia('12:00')).toBe('Buenas tardes');
    expect(momentoDelDia('18:59')).toBe('Buenas tardes');
    expect(momentoDelDia('19:00')).toBe('Buenas noches');
    expect(resolverSaludo('¡{momento}! Soy Eco', '09:00')).toBe('¡Buenos días! Soy Eco');
  });

  it('vigenteEn: siempre, anual y exacto', () => {
    expect(vigenteEn(normal, '2026-01-01')).toBe(true);
    expect(vigenteEn(campania, '2026-11-04')).toBe(false);
  });

  it('ahoraEnGuatemala usa UTC-6', () => {
    expect(ahoraEnGuatemala(new Date('2026-12-25T05:30:00Z'))).toEqual({
      fecha: '2026-12-24',
      hora: '23:30',
    });
  });
});

describe('validación', () => {
  const base = {
    nombre: 'Navidad',
    modulo: 'GLOBAL',
    saludo: '¡{momento}! 🎄',
    fechaInicio: null,
    fechaFin: null,
    repetirAnual: false,
    prioridad: 10,
    activo: true,
  };
  const valida = (cambio) => esquemaCrearSaludo.safeParse({ ...base, ...cambio }).success;

  it('acepta {momento} y rechaza otros comodines', () => {
    expect(valida({})).toBe(true);
    expect(valida({ saludo: '¡Hola {nombre}!' })).toBe(false);
  });

  it.each([
    ['solo fecha de inicio', { fechaInicio: '2026-12-15' }],
    ['fin antes del inicio sin repetir', { fechaInicio: '2026-12-15', fechaFin: '2026-12-01' }],
    ['Markdown', { saludo: '**Hola**' }],
    ['301 caracteres', { saludo: 'a'.repeat(301) }],
    ['módulo inventado', { modulo: 'PAUTAS' }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(valida(cambio)).toBe(false);
  });

  it('con repetición anual el fin puede ser anterior (cruza el año)', () => {
    expect(valida({ fechaInicio: '2026-12-31', fechaFin: '2026-01-03', repetirAnual: true })).toBe(
      true,
    );
  });
});

describe('choques, próxima temporada y textos', () => {
  it('avisa si otro del mismo módulo y prioridad coincide en algún día', () => {
    const otraNavidad = s('Otra Navidad', {
      fechaInicio: '2026-12-20',
      fechaFin: '2026-12-22',
      prioridad: 10,
    });
    expect(
      choquesDeSaludo(navidad, [...todos, otraNavidad], '2026-10-28').map((x) => x.nombre),
    ).toEqual(['Otra Navidad']);
    expect(choquesDeSaludo(campania, todos, '2026-10-28')).toEqual([]);
  });

  it('próxima temporada desde una fecha', () => {
    expect(proximaTemporada(todos, '2026-10-28')).toMatchObject({
      saludo: { nombre: 'Campaña' },
      inicio: '2026-11-01',
    });
    expect(proximaTemporada(todos, '2026-12-27')).toMatchObject({
      saludo: { nombre: 'Año Nuevo' },
      inicio: '2026-12-31',
    });
  });

  it('vigencia legible', () => {
    expect(vigenciaLegible(normal)).toBe('Siempre');
    expect(vigenciaLegible(navidad)).toBe('Cada año del 15 dic al 26 dic');
    expect(vigenciaLegible(campania)).toBe('Del 1 nov al 3 nov 2026');
  });

  it('saludo base', () => {
    expect(tieneSaludoBase(todos)).toBe(true);
    expect(tieneSaludoBase([navidad])).toBe(false);
  });
});
