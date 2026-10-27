import { describe, expect, it } from 'vitest';
import { esquemaCrearDescanso, esquemaGuardarHorario } from './agentes.js';

const semana = (cambios = {}) => ({
  version: 'v',
  dias: [1, 2, 3, 4, 5, 6, 7].map((diaSemana) => ({
    diaSemana,
    rangos: diaSemana <= 5 ? [{ horaInicio: '08:00', horaFin: '17:00' }] : [],
    ...cambios[diaSemana],
  })),
});

describe('esquemaGuardarHorario', () => {
  it('acepta lunes a viernes con fin de semana de descanso', () => {
    expect(esquemaGuardarHorario.safeParse(semana()).success).toBe(true);
  });

  it('"23:59" significa hasta medianoche y se guarda como 24:00', () => {
    const r = esquemaGuardarHorario.parse(
      semana({ 6: { rangos: [{ horaInicio: '21:00', horaFin: '23:59' }] } }),
    );
    expect(r.dias[5].rangos[0].horaFin).toBe('24:00');
  });

  it('permite turno partido (dos rangos que no se cruzan)', () => {
    const partido = {
      rangos: [
        { horaInicio: '08:00', horaFin: '12:00' },
        { horaInicio: '13:00', horaFin: '17:00' },
      ],
    };
    expect(esquemaGuardarHorario.safeParse(semana({ 1: partido })).success).toBe(true);
  });

  it.each([
    ['fin antes del inicio', { 1: { rangos: [{ horaInicio: '17:00', horaFin: '08:00' }] } }],
    [
      'rangos que se cruzan',
      {
        1: {
          rangos: [
            { horaInicio: '08:00', horaFin: '12:00' },
            { horaInicio: '11:00', horaFin: '17:00' },
          ],
        },
      },
    ],
    ['hora inválida', { 1: { rangos: [{ horaInicio: '25:00', horaFin: '26:00' }] } }],
  ])('rechaza %s', (_caso, cambios) => {
    expect(esquemaGuardarHorario.safeParse(semana(cambios)).success).toBe(false);
  });

  it('exige los 7 días sin repetir', () => {
    const s = semana();
    s.dias[6].diaSemana = 1;
    expect(esquemaGuardarHorario.safeParse(s).success).toBe(false);
  });
});

describe('esquemaCrearDescanso', () => {
  it('acepta un solo día y convierte motivo vacío en null', () => {
    expect(
      esquemaCrearDescanso.parse({ desde: '2026-12-24', hasta: '2026-12-24', motivo: ' ' }).motivo,
    ).toBeNull();
  });
  it('rechaza "hasta" antes de "desde"', () => {
    expect(
      esquemaCrearDescanso.safeParse({ desde: '2026-12-25', hasta: '2026-12-24', motivo: null })
        .success,
    ).toBe(false);
  });
});
