// <input type="datetime-local"> trabaja con 'YYYY-MM-DDTHH:mm' en la hora local del navegador
// (Guatemala, UTC-6). La API guarda instantes en ISO con zona. Estas funciones convierten entre ambos.

const dosDigitos = (n) => String(n).padStart(2, '0');

export function isoALocal(iso) {
  if (!iso) return '';
  const f = new Date(iso);
  return `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}-${dosDigitos(f.getDate())}T${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`;
}

// El navegador interpreta 'YYYY-MM-DDTHH:mm' como hora local.
export const localAIso = (local) => (local ? new Date(local).toISOString() : null);
