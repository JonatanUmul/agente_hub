import { useInfiniteQuery } from '@tanstack/react-query';
import { buscarHistorial } from './api.js';

// Páginas con cursor: cada respuesta trae `siguiente` (id desde el que seguir) o null si no hay más.
export const useHistorial = (filtros) =>
  useInfiniteQuery({
    queryKey: ['auditoria', filtros],
    queryFn: ({ pageParam }) => buscarHistorial({ ...filtros, antesDe: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (ultima) => ultima.siguiente ?? undefined,
  });
