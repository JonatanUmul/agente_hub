import { describe, expect, it } from 'vitest';
import { errorEntreParametros } from './configuracion.js';
import {
  errorTextoMensaje,
  mensajesParaElBot,
  resumenMensajes,
  textoDeEjemplo,
} from './mensajes.js';

const tipo = (extra = {}) => ({ categoria: 'Inactividad', comodines: ['{minutos}'], ...extra });

describe('errorTextoMensaje', () => {
  it('acepta comodines del tipo (con o sin llaves en el catálogo) y saltos de línea', () => {
    expect(errorTextoMensaje('Cerramos en {minutos} min', tipo())).toBeNull();
    expect(errorTextoMensaje('Hola\n1. Comprar\n2. Soporte', tipo({ comodines: [] }))).toBeNull();
  });

  it.each([
    ['muy corto', 'a'],
    ['1001 caracteres', 'a'.repeat(1001)],
    ['comodín ajeno', 'Hola {nombre}'],
    ['negrita Markdown', '**Hola**'],
    ['encabezado', '# Hola'],
    ['negrita fuera de pauta', '*Hola* amigo'],
  ])('rechaza %s', (_caso, texto) => {
    expect(errorTextoMensaje(texto, tipo())).not.toBeNull();
  });

  it('la *negrita* sí se permite en pauta', () => {
    expect(
      errorTextoMensaje('*{pauta}*{vigencia}', {
        categoria: 'Pauta',
        comodines: ['pauta', 'vigencia'],
      }),
    ).toBeNull();
  });
});

describe('mensajesParaElBot, ejemplo y resumen', () => {
  const tipos = [
    {
      clave: 'a',
      categoria: 'Inicio',
      versiones: [
        { id: 2, texto: 'dos', activo: true, orden: 5 },
        { id: 1, texto: 'uno', activo: true, orden: 10 },
        { id: 3, texto: 'tres', activo: false, orden: 1 },
      ],
    },
    { clave: 'b', categoria: 'Inicio', versiones: [] },
  ];

  it('solo activas, por orden, y omite claves sin texto', () => {
    expect(mensajesParaElBot(tipos)).toEqual({ a: ['dos', 'uno'] });
  });

  it('reemplaza comodines de ejemplo', () => {
    expect(textoDeEjemplo('{nombre}: {minutos} min {x}', { minutos: 15 })).toBe('Ana: 15 min {x}');
  });

  it('cuenta claves con versiones activas por categoría', () => {
    expect(resumenMensajes(tipos)).toEqual([{ categoria: 'Inicio', activos: 1, total: 2 }]);
  });
});

describe('errorEntreParametros', () => {
  it('el cierre debe ser mayor que el aviso', () => {
    expect(
      errorEntreParametros({ minutos_aviso_inactividad: 10, minutos_cierre_inactividad: 10 }),
    ).not.toBeNull();
    expect(
      errorEntreParametros({ minutos_aviso_inactividad: 10, minutos_cierre_inactividad: 11 }),
    ).toBeNull();
    expect(errorEntreParametros({ minutos_aviso_inactividad: 10 })).toBeNull();
  });
});
