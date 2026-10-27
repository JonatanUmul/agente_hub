import { api } from '../../lib/api.js';

export const listarReglas = () => api('/reglas');
export const crearRegla = (datos) => api('/reglas', { method: 'POST', body: datos });
export const editarRegla = ({ id, ...datos }) =>
  api(`/reglas/${id}`, { method: 'PUT', body: datos });
export const cambiarActivoRegla = ({ id, activo, version }) =>
  api(`/reglas/${id}/activo`, { method: 'PATCH', body: { activo, version } });
