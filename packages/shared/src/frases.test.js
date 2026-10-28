import { describe, expect, it } from 'vitest';
import {
  botsSinFrasesGenerales,
  esquemaCrearFrase,
  frasesParaElBot,
  largoFrase,
  ordenarGrupo,
  resumenFrasesActivas,
} from './frases.js';

const valida = (frase) =>
  esquemaCrearFrase.safeParse({ modulo: 'GLOBAL', situacion: 'general', frase, activo: true })
    .success;

describe('esquemaCrearFrase', () => {
  it('recorta espacios y cuenta los emojis como PostgreSQL', () => {
    const r = esquemaCrearFrase.parse({
      modulo: 'SAC',
      situacion: 'problema',
      frase: '  ¿Algo más? 😊  ',
      activo: true,
    });
    expect(r.frase).toBe('¿Algo más? 😊');
    expect(largoFrase('😊😊😊')).toBe(3);
    expect(valida('😊😊😊')).toBe(true);
  });

  it('acepta 200 caracteres con emojis y la negrita de WhatsApp', () => {
    expect(valida(`${'a'.repeat(199)}😊`)).toBe(true);
    expect(valida('¿Te ayudo con *algo* más?')).toBe(true);
  });

  it.each([
    ['2 caracteres', 'Ok'],
    ['201 caracteres', 'a'.repeat(201)],
    ['negrita Markdown', '¿**Algo** más?'],
    ['encabezado', '# ¿Algo más?'],
    ['enlace', 'Mira [aquí](https://ecofiltro.com.gt)'],
    ['código', '¿Algo `más`?'],
    ['viñeta', '- ¿Algo más?'],
    ['salto de línea', '¿Algo más?\n😊'],
  ])('rechaza %s', (_caso, frase) => {
    expect(valida(frase)).toBe(false);
  });
});

const f = (id, modulo, situacion, orden = 100, activo = true) => ({
  id,
  modulo,
  situacion,
  orden,
  activo,
});

describe('frasesParaElBot (igual que n8n)', () => {
  const frases = [
    f(1, 'GLOBAL', 'general', 20),
    f(2, 'SAC', 'general', 10),
    f(3, 'COMPRA', 'general', 5),
    f(4, 'SAC', 'problema', 10),
    f(5, 'GLOBAL', 'problema', 10, false),
  ];

  it('usa GLOBAL + su módulo, activas, por orden e id', () => {
    expect(frasesParaElBot(frases, 'SAC', 'general').map((x) => x.id)).toEqual([2, 1]);
    expect(frasesParaElBot(frases, 'SAC', 'problema').map((x) => x.id)).toEqual([4]);
  });

  it('sin frases de la situación usa las de general', () => {
    expect(frasesParaElBot(frases, 'COMPRA', 'problema').map((x) => x.id)).toEqual([3, 1]);
  });
});

describe('botsSinFrasesGenerales', () => {
  it('avisa del bot que no tiene general activa propia ni GLOBAL', () => {
    expect(botsSinFrasesGenerales([f(1, 'COMPRA', 'general')])).toEqual([
      { modulo: 'SAC', bot: 'atención al cliente' },
    ]);
    expect(botsSinFrasesGenerales([f(1, 'GLOBAL', 'general')])).toEqual([]);
    expect(botsSinFrasesGenerales([f(1, 'GLOBAL', 'general', 1, false)])).toHaveLength(2);
  });
});

describe('ordenarGrupo y resumenFrasesActivas', () => {
  it('numera de 10 en 10', () => {
    expect(ordenarGrupo([7, 3])).toEqual([
      { id: 7, orden: 10 },
      { id: 3, orden: 20 },
    ]);
  });

  it('cuenta activas por módulo y situación', () => {
    const resumen = resumenFrasesActivas([
      f(1, 'SAC', 'general'),
      f(2, 'SAC', 'general'),
      f(3, 'SAC', 'producto', 1, false),
    ]);
    expect(resumen.find((r) => r.modulo === 'SAC')).toEqual({
      modulo: 'SAC',
      general: 2,
      producto: 0,
      problema: 0,
    });
  });
});
