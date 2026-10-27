import { api } from '../../lib/api.js';

export const listarArchivos = () => api('/multimedia');
export const crearArchivo = (datos) => api('/multimedia', { method: 'POST', body: datos });
export const editarArchivo = ({ id, ...datos }) =>
  api(`/multimedia/${id}`, { method: 'PUT', body: datos });
export const cambiarActivoArchivo = ({ id, activo, version }) =>
  api(`/multimedia/${id}/activo`, { method: 'PATCH', body: { activo, version } });
