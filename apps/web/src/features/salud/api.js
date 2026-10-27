import { api } from '../../lib/api.js';

export const obtenerSalud = () => api('/salud', { aceptarEstados: [503] });
