import { api } from '../../lib/api.js';

export const listarPautasResumen = () => api('/pautas/resumen');
export const listarPautas = () => api('/pautas');
export const crearPauta = (datos) => api('/pautas', { method: 'POST', body: datos });
export const editarPauta = ({ id, ...datos }) =>
  api(`/pautas/${id}`, { method: 'PUT', body: datos });
export const cambiarActivoPauta = ({ id, activo, version }) =>
  api(`/pautas/${id}/activo`, { method: 'PATCH', body: { activo, version } });
