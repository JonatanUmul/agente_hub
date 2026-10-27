import { api } from '../../lib/api.js';

export const listarInterruptores = () => api('/configuracion/interruptores');
export const cambiarInterruptor = ({ clave, habilitado }) =>
  api(`/configuracion/interruptores/${clave}`, { method: 'PUT', body: { habilitado } });
