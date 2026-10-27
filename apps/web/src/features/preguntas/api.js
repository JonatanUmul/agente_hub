import { api } from '../../lib/api.js';

export const listarPreguntas = () => api('/preguntas');
export const obtenerSiguienteNumero = () => api('/preguntas/siguiente-numero');
export const crearPregunta = (datos) => api('/preguntas', { method: 'POST', body: datos });
export const editarPregunta = ({ id, ...datos }) =>
  api(`/preguntas/${id}`, { method: 'PUT', body: datos });
export const cambiarActivoPregunta = ({ id, activo, version }) =>
  api(`/preguntas/${id}/activo`, { method: 'PATCH', body: { activo, version } });
