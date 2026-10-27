import { api } from '../../lib/api.js';

export const listarAgentes = () => api('/agentes');
export const guardarHorario = ({ id, dias, version }) =>
  api(`/agentes/${id}/horario`, { method: 'PUT', body: { dias, version } });
export const agregarDescanso = ({ id, ...datos }) =>
  api(`/agentes/${id}/descansos`, { method: 'POST', body: datos });
export const quitarDescanso = ({ id, descansoId }) =>
  api(`/agentes/${id}/descansos/${descansoId}`, { method: 'DELETE' });
