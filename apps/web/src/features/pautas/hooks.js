import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cambiarActivoPauta,
  crearPauta,
  editarPauta,
  listarPautas,
  listarPautasResumen,
} from './api.js';

export const usePautasResumen = () =>
  useQuery({ queryKey: ['pautas', 'resumen'], queryFn: listarPautasResumen });
export const usePautas = () => useQuery({ queryKey: ['pautas', 'lista'], queryFn: listarPautas });

// Una pauta cambia el descuento vigente de sus productos: también recargamos productos y multimedia.
function useMutacionPautas(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all(
        [['pautas'], ['productos'], ['multimedia']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

export const useCrearPauta = () => useMutacionPautas(crearPauta);
export const useEditarPauta = () => useMutacionPautas(editarPauta);
export const useCambiarActivoPauta = () => useMutacionPautas(cambiarActivoPauta);
