import { api } from '../../lib/api.js';

// Solo los filtros con valor: la API trata '' igual que "sin filtro", pero así la URL queda limpia.
export const consultaDe = (filtros) =>
  new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();

export const obtenerReporte = (filtros) => api(`/reportes?${consultaDe(filtros)}`);
export const obtenerDetalle = (filtros) => api(`/reportes/detalle?${consultaDe(filtros)}`);

// El CSV se descarga con un enlace normal (GET con la cookie de sesión): no pasa por fetch.
export const urlExportar = (tabla, filtros) =>
  `/api/reportes/exportar/${tabla}?${consultaDe(filtros)}`;
