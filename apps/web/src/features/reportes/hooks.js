import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { obtenerDetalle, obtenerReporte } from './api.js';

// La API guarda en caché 5 minutos; aquí no hace falta pedir más seguido.
// keepPreviousData: al cambiar un filtro se siguen viendo los datos anteriores (atenuados) mientras carga.
const opciones = { staleTime: 5 * 60_000, placeholderData: keepPreviousData, retry: false };

export const useReporte = (filtros, habilitado) =>
  useQuery({
    queryKey: ['reportes', filtros],
    queryFn: () => obtenerReporte(filtros),
    enabled: habilitado,
    ...opciones,
  });

export const useDetalle = (filtros, habilitado) =>
  useQuery({
    queryKey: ['reportes', 'detalle', filtros],
    queryFn: () => obtenerDetalle(filtros),
    enabled: habilitado,
    ...opciones,
  });
