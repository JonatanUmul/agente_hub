import { describe, expect, it } from 'vitest';
import { duracionLegible, esquemaFiltrosAccesos, navegadorLegible } from './accesos.js';

describe('navegadorLegible', () => {
  it('reconoce navegador y sistema', () => {
    expect(
      navegadorLegible(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      ),
    ).toBe('Chrome en Windows');
    expect(
      navegadorLegible(
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0',
      ),
    ).toBe('Edge en Windows');
    expect(
      navegadorLegible(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari en iPhone/iPad');
    expect(navegadorLegible('curl/8.0')).toBe('Otro navegador');
    expect(navegadorLegible(null)).toBeNull();
  });
});

describe('duracionLegible', () => {
  it('muestra horas y minutos', () => {
    expect(duracionLegible(0)).toBe('menos de 1 min');
    expect(duracionLegible(45)).toBe('45 min');
    expect(duracionLegible(120)).toBe('2 h');
    expect(duracionLegible(95)).toBe('1 h 35 min');
  });
});

describe('esquemaFiltrosAccesos', () => {
  it('acepta usuario vacío y rechaza un rango invertido', () => {
    expect(
      esquemaFiltrosAccesos.parse({ desde: '2026-11-01', hasta: '2026-11-04', usuarioId: '' }),
    ).toEqual({ desde: '2026-11-01', hasta: '2026-11-04' });
    expect(
      esquemaFiltrosAccesos.safeParse({ desde: '2026-11-04', hasta: '2026-11-01' }).success,
    ).toBe(false);
  });
});
