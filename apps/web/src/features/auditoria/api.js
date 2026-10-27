import { api } from '../../lib/api.js';

// Solo se envían los filtros con valor.
export function buscarHistorial(filtros) {
  const query = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== '' && v != null),
  );
  return api(`/auditoria?${query}`);
}
