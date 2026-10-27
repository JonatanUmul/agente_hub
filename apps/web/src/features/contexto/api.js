import { api } from '../../lib/api.js';

export const obtenerContexto = (modulo) => api(`/contexto/${modulo}`);
