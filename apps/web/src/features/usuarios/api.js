import { api } from '../../lib/api.js';

export const listarUsuarios = () => api('/usuarios');
export const crearUsuario = (datos) => api('/usuarios', { method: 'POST', body: datos });
export const editarUsuario = ({ id, ...cambios }) =>
  api(`/usuarios/${id}`, { method: 'PATCH', body: cambios });
export const restablecerContrasena = ({ id, contrasena }) =>
  api(`/usuarios/${id}/contrasena`, { method: 'POST', body: { contrasena } });
export const cerrarSesiones = ({ id }) =>
  api(`/usuarios/${id}/cerrar-sesiones`, { method: 'POST' });

export const obtenerAccesos = (filtros) =>
  api(`/accesos?${new URLSearchParams(Object.entries(filtros).filter(([, v]) => v))}`);
