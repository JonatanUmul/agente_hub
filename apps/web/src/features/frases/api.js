import { api } from '../../lib/api.js';

export const listarFrases = () => api('/frases-cierre');
export const crearFrase = (datos) => api('/frases-cierre', { method: 'POST', body: datos });
export const editarFrase = ({ id, ...datos }) =>
  api(`/frases-cierre/${id}`, { method: 'PUT', body: datos });
export const cambiarActivoFrase = ({ id, activo, version }) =>
  api(`/frases-cierre/${id}/activo`, { method: 'PATCH', body: { activo, version } });
export const eliminarFrase = ({ id, version }) =>
  api(`/frases-cierre/${id}?version=${encodeURIComponent(version)}`, { method: 'DELETE' });
export const reordenarFrases = (lista) =>
  api('/frases-cierre/orden', { method: 'PUT', body: lista });
export const cambiarCierreAutomatico = (habilitado) =>
  api('/frases-cierre/cierre-automatico', { method: 'PUT', body: { habilitado } });
