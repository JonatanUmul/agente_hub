// Formato de números y fechas del dashboard (hora de Guatemala, como las consultas).
const formatoEntero = new Intl.NumberFormat('es-GT');
export const entero = (n) => (n === null || n === undefined ? '—' : formatoEntero.format(n));
export const porcentajeDe = (n) => (n === null || n === undefined ? '—' : `${n}%`);

// 'YYYY-MM-DD' → '27 oct'. Se interpreta a mediodía UTC para que ninguna zona cambie el día.
const formatoDiaCorto = new Intl.DateTimeFormat('es-GT', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
export const diaCorto = (iso) => formatoDiaCorto.format(new Date(`${iso}T12:00:00Z`));

const formatoFechaHora = new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Guatemala',
});
export const fechaHora = (iso) => formatoFechaHora.format(new Date(iso));

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // ISO 1 = lunes

// Motivos de agent_hours_notice_control → texto legible.
const MOTIVOS = {
  fuera_de_horario_lunes_viernes: 'Fuera de horario (lunes a viernes)',
  fuera_de_horario_sabado: 'Fuera de horario (sábado)',
  fuera_de_horario_domingo: 'Fuera de horario (domingo)',
};
export const motivoLegible = (m) => MOTIVOS[m] ?? m ?? 'Sin motivo';

export const porcentajeEntre = (parte, total) =>
  total ? `${Math.round((parte / total) * 1000) / 10}%` : '—';
