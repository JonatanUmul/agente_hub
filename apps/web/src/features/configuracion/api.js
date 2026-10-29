import { api } from '../../lib/api.js';

export const listarInterruptores = () => api('/configuracion/interruptores');
export const cambiarInterruptor = ({ clave, habilitado }) =>
  api(`/configuracion/interruptores/${clave}`, { method: 'PUT', body: { habilitado } });
export const listarParametros = () => api('/configuracion/parametros');
export const cambiarParametro = ({ clave, valor, version }) =>
  api(`/configuracion/parametros/${clave}`, { method: 'PUT', body: { valor, version } });
