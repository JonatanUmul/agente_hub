const formatoFecha = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
export const fecha = (iso) => (iso ? formatoFecha.format(new Date(iso)) : '—');

// La moneda la define eco_configuracion ('Q' en Ecofiltro); aquí solo formateamos el número.
const formatoMonto = new Intl.NumberFormat('es-GT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const monto = (valor) =>
  valor === null || valor === undefined ? '—' : `Q ${formatoMonto.format(valor)}`;

export const porcentaje = (valor) => (valor === null || valor === undefined ? '—' : `${valor}%`);
