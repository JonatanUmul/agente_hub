// Muestra un valor de la base (venido de JSON) de forma legible.
export function valorLegible(valor) {
  if (valor === null || valor === undefined) return '—';
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '(vacío)';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

// 'precio_base' → 'precio base'
export const nombreCampo = (campo) => campo.replaceAll('_', ' ');
