import { describe, expect, it } from 'vitest';
import { esquemaCrearPregunta } from './preguntas.js';
import { contextosDeRegla, esquemaCrearRegla } from './reglas.js';

const regla = {
  codigo: 'R1',
  modulo: 'SAC',
  destino: 'REDACTOR',
  categoria: 'tono',
  titulo: 'Tono',
  regla: 'Responder con amabilidad',
  prioridad: 50,
  activo: true,
  vigenteDesde: null,
  vigenteHasta: null,
};

describe('esquemaCrearRegla', () => {
  it('acepta una regla válida', () => {
    expect(esquemaCrearRegla.safeParse(regla).success).toBe(true);
  });
  it.each([
    ['módulo inventado', { modulo: 'VENTAS' }],
    ['destino inventado', { destino: 'TODO' }],
    ['texto vacío', { regla: '   ' }],
    [
      'vigencia invertida',
      { vigenteDesde: '2026-12-02T00:00:00Z', vigenteHasta: '2026-12-01T00:00:00Z' },
    ],
  ])('rechaza %s', (_caso, cambio) => {
    expect(esquemaCrearRegla.safeParse({ ...regla, ...cambio }).success).toBe(false);
  });
});

describe('contextosDeRegla (filtro de eco_contexto)', () => {
  it('GLOBAL aparece en todos los módulos', () => {
    expect(contextosDeRegla({ modulo: 'GLOBAL', vigente: true })).toHaveLength(5);
  });
  it('una regla de módulo aparece solo en el suyo', () => {
    expect(contextosDeRegla({ modulo: 'COMPRA', vigente: true })).toEqual(['COMPRA']);
  });
  it('no vigente no aparece', () => {
    expect(contextosDeRegla({ modulo: 'GLOBAL', vigente: false })).toEqual([]);
  });
});

describe('esquemaCrearPregunta', () => {
  const pregunta = {
    numero: 1,
    pregunta: '¿Cada cuánto cambio el filtro?',
    tema: '',
    palabrasClave: [],
    respuesta: 'Cada año',
    modulos: ['SAC', 'SAC'],
    orden: 100,
    activo: true,
  };
  it('quita módulos repetidos y convierte tema vacío en null', () => {
    expect(esquemaCrearPregunta.parse(pregunta)).toMatchObject({ modulos: ['SAC'], tema: null });
  });
  it('exige al menos un módulo válido', () => {
    expect(esquemaCrearPregunta.safeParse({ ...pregunta, modulos: [] }).success).toBe(false);
    expect(esquemaCrearPregunta.safeParse({ ...pregunta, modulos: ['OTRO'] }).success).toBe(false);
  });
});
