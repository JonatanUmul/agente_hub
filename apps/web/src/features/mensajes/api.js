import { api } from '../../lib/api.js';

export const listarMensajes = () => api('/mensajes');
export const crearMensaje = (datos) => api('/mensajes', { method: 'POST', body: datos });
export const editarMensaje = ({ id, ...datos }) =>
  api(`/mensajes/${id}`, { method: 'PUT', body: datos });
export const cambiarActivoMensaje = ({ id, activo, version, confirmar = false }) =>
  api(`/mensajes/${id}/activo`, { method: 'PATCH', body: { activo, version, confirmar } });
export const eliminarMensaje = ({ id, version, confirmar = false }) =>
  api(`/mensajes/${id}?${new URLSearchParams({ version, confirmar: String(confirmar) })}`, {
    method: 'DELETE',
  });
export const reordenarMensajes = (lista) => api('/mensajes/orden', { method: 'PUT', body: lista });
