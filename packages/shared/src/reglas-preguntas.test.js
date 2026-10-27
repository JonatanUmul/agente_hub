import { describe, expect, it } from 'vitest';
import { esquemaCrearPregunta } from './preguntas.js';
import {
  agentesAfectados,
  contextosDeRegla,
  esquemaCrearRegla,
  resumenPorAgente,
} from './reglas.js';

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

  it('acepta temas largos como los de producción (157 caracteres)', () => {
    const tema = 'Consultas de stock, inventario, existencia o disponibilidad '
      .repeat(3)
      .slice(0, 157);
    expect(esquemaCrearPregunta.safeParse({ ...pregunta, tema }).success).toBe(true);
  });
});

describe('destinos nuevos', () => {
  it('acepta SELECTOR y VISION en cualquier módulo', () => {
    expect(
      esquemaCrearRegla.safeParse({ ...regla, destino: 'SELECTOR', modulo: 'SAC' }).success,
    ).toBe(true);
    expect(esquemaCrearRegla.safeParse({ ...regla, destino: 'VISION' }).success).toBe(true);
  });

  it('ORQUESTADOR solo en GLOBAL', () => {
    const r = esquemaCrearRegla.safeParse({ ...regla, destino: 'ORQUESTADOR', modulo: 'SAC' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path).toEqual(['modulo']);
    expect(
      esquemaCrearRegla.safeParse({ ...regla, destino: 'ORQUESTADOR', modulo: 'GLOBAL' }).success,
    ).toBe(true);
  });

  it('una regla TODOS afecta a todos los agentes; una propia, solo a los suyos', () => {
    expect(agentesAfectados({ destino: 'TODOS' })).toHaveLength(5);
    expect(agentesAfectados({ destino: 'ORQUESTADOR' })).toEqual(['Orquestador central']);
  });
});

describe('resumenPorAgente', () => {
  const r = (destino, modulo, largo, vigente = true) => ({
    destino,
    modulo,
    regla: 'x'.repeat(largo),
    vigente,
  });
  const fila = (resumen, destino, modulo) =>
    resumen.find((f) => f.destino === destino && f.modulo === modulo);

  it('suma propias + TODOS de GLOBAL y del módulo; ignora otros módulos y no vigentes', () => {
    const resumen = resumenPorAgente([
      r('REDACTOR', 'GLOBAL', 100),
      r('REDACTOR', 'COMPRA', 50),
      r('REDACTOR', 'SAC', 999), // otro módulo
      r('TODOS', 'GLOBAL', 10),
      r('TODOS', 'COMPRA', 5),
      r('REDACTOR', 'GLOBAL', 7777, false), // no vigente
    ]);
    expect(fila(resumen, 'REDACTOR', 'COMPRA')).toMatchObject({
      propias: 2,
      generales: 2,
      caracteres: 165,
    });
  });

  it('el orquestador solo recibe GLOBAL (una sola fila)', () => {
    const resumen = resumenPorAgente([
      r('ORQUESTADOR', 'GLOBAL', 10),
      r('TODOS', 'SAC', 50),
      r('TODOS', 'GLOBAL', 5),
    ]);
    expect(resumen.filter((f) => f.destino === 'ORQUESTADOR')).toEqual([
      expect.objectContaining({ modulo: 'GLOBAL', propias: 1, generales: 1, caracteres: 15 }),
    ]);
  });

  it('advierte sin reglas propias y al pasar de 12 000 caracteres', () => {
    const resumen = resumenPorAgente([
      r('SELECTOR', 'GLOBAL', 11_000),
      r('TODOS', 'GLOBAL', 1_500),
    ]);
    expect(fila(resumen, 'SELECTOR', 'SAC')).toMatchObject({
      excedeLimite: true,
      sinPropias: false,
    });
    expect(fila(resumen, 'VISION', 'SAC')).toMatchObject({ sinPropias: true });
  });
});
