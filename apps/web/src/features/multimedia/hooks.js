import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cambiarActivoArchivo, crearArchivo, editarArchivo, listarArchivos } from './api.js';

const CLAVE = ['multimedia'];

export const useArchivos = () => useQuery({ queryKey: CLAVE, queryFn: listarArchivos });

// Los conteos de archivos por pauta también cambian.
function useMutacionArchivos(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all(
        [CLAVE, ['pautas']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}

export const useCrearArchivo = () => useMutacionArchivos(crearArchivo);
export const useEditarArchivo = () => useMutacionArchivos(editarArchivo);
export const useCambiarActivoArchivo = () => useMutacionArchivos(cambiarActivoArchivo);
