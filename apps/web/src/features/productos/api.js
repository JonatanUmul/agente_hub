import { api } from '../../lib/api.js';

export const listarProductos = () => api('/productos');
export const editarProducto = ({ id, ...datos }) =>
  api(`/productos/${id}`, { method: 'PUT', body: datos });
export const cambiarActivoProducto = ({ id, activo, version }) =>
  api(`/productos/${id}/activo`, { method: 'PATCH', body: { activo, version } });
