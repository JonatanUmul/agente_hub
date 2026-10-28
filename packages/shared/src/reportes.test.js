import { describe, expect, it } from 'vitest';
import {
  diasEntre,
  esquemaFiltrosReporte,
  periodoAnterior,
  ultimosDias,
  variacion,
} from './reportes.js';

describe('esquemaFiltrosReporte', () => {
  it('acepta un rango válido y normaliza la bandeja', () => {
    expect(
      esquemaFiltrosReporte.parse({
        desde: '2026-10-01',
        hasta: '2026-10-30',
        bandeja: ' Televentas ',
      }),
    ).toMatchObject({
      bandeja: 'televentas',
    });
  });
  it('exige fechas y rechaza más de 365 días o "hasta" antes de "desde"', () => {
    expect(esquemaFiltrosReporte.safeParse({}).success).toBe(false);
    expect(
      esquemaFiltrosReporte.safeParse({ desde: '2025-01-01', hasta: '2026-01-01' }).success,
    ).toBe(false); // 366 días
    expect(
      esquemaFiltrosReporte.safeParse({ desde: '2025-01-02', hasta: '2026-01-01' }).success,
    ).toBe(true); // 365
    expect(
      esquemaFiltrosReporte.safeParse({ desde: '2026-10-02', hasta: '2026-10-01' }).success,
    ).toBe(false);
  });
  it('rechaza un módulo inventado y un agente que no es número', () => {
    expect(
      esquemaFiltrosReporte.safeParse({
        desde: '2026-10-01',
        hasta: '2026-10-02',
        modulo: 'VENTAS',
      }).success,
    ).toBe(false);
    expect(
      esquemaFiltrosReporte.safeParse({
        desde: '2026-10-01',
        hasta: '2026-10-02',
        agente: '1; DROP',
      }).success,
    ).toBe(false);
  });
});

describe('periodos', () => {
  it('cuenta los días incluyendo ambos extremos', () => {
    expect(diasEntre('2026-10-01', '2026-10-30')).toBe(30);
  });
  it('el periodo anterior tiene el mismo largo y termina el día antes', () => {
    expect(periodoAnterior({ desde: '2026-10-01', hasta: '2026-10-30' })).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    expect(periodoAnterior({ desde: '2026-03-01', hasta: '2026-03-01' })).toEqual({
      desde: '2026-02-28',
      hasta: '2026-02-28',
    });
  });
  it('últimos 30 días en hora de Guatemala', () => {
    // 27-10-2026 03:00 UTC = 26-10-2026 21:00 en Guatemala
    expect(ultimosDias(30, new Date('2026-10-27T03:00:00Z'))).toEqual({
      desde: '2026-09-27',
      hasta: '2026-10-26',
    });
  });
});

describe('variacion', () => {
  it('calcula el % con un decimal', () => {
    expect(variacion(112, 100)).toBe(12);
    expect(variacion(50, 80)).toBe(-37.5);
  });
  it('sin base anterior no hay variación', () => {
    expect(variacion(10, 0)).toBeNull();
  });
});
