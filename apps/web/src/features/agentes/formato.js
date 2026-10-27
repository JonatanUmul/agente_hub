import { DIAS_SEMANA, finParaMostrar } from '@ecofiltro/shared';

const formatoFecha = new Intl.DateTimeFormat('es-GT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
// Las fechas llegan como 'YYYY-MM-DD' (sin hora): se formatean en UTC para que no cambien de día.
export const fechaCorta = (iso) => formatoFecha.format(new Date(`${iso}T00:00:00Z`));

export const nombreAgente = (a) => [a.nombre, a.apellido].filter(Boolean).join(' ') || a.email;

// "08:00–17:00" o "08:00–12:00, 13:00–17:00".
export const textoRangos = (rangos) =>
  rangos.map((r) => `${r.horaInicio}–${finParaMostrar(r.horaFin)}`).join(', ');

export const resumenSemana = (horario) =>
  horario.map((d) => ({
    ...DIAS_SEMANA[d.diaSemana - 1],
    trabaja: d.rangos.length > 0,
    texto: textoRangos(d.rangos),
  }));
