import { useQuery } from '@tanstack/react-query';
import { obtenerContexto } from './api.js';

// staleTime 0: la vista previa siempre se pide de nuevo, para ver el estado de este momento.
export const useContexto = (modulo) =>
  useQuery({
    queryKey: ['contexto', modulo],
    queryFn: () => obtenerContexto(modulo),
    staleTime: 0,
  });
