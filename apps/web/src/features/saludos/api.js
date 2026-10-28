import { api } from '../../lib/api.js';

export const listarSaludos = () => api('/saludos');
export const saludoVigente = (modulo) => api(`/saludos/vigente?modulo=${modulo}`);
export const crearSaludo = (datos) => api('/saludos', { method: 'POST', body: datos });
export const editarSaludo = ({ id, ...datos }) =>
  api(`/saludos/${id}`, { method: 'PUT', body: datos });
export const cambiarActivoSaludo = ({ id, activo, version }) =>
  api(`/saludos/${id}/activo`, { method: 'PATCH', body: { activo, version } });
export const eliminarSaludo = ({ id, version }) =>
  api(`/saludos/${id}?version=${encodeURIComponent(version)}`, { method: 'DELETE' });
