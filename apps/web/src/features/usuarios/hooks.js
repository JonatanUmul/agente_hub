import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cerrarSesiones,
  crearUsuario,
  editarUsuario,
  listarUsuarios,
  obtenerAccesos,
  restablecerContrasena,
} from './api.js';

const CLAVE = ['usuarios'];

export const useUsuarios = () => useQuery({ queryKey: CLAVE, queryFn: listarUsuarios });

// Tras cualquier cambio volvemos a pedir la lista: la API es la fuente de verdad.
function useMutacionUsuarios(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE });
      queryClient.invalidateQueries({ queryKey: ['accesos'] });
    },
  });
}

export const useCrearUsuario = () => useMutacionUsuarios(crearUsuario);
export const useEditarUsuario = () => useMutacionUsuarios(editarUsuario);
export const useRestablecerContrasena = () => useMutacionUsuarios(restablecerContrasena);
export const useCerrarSesiones = () => useMutacionUsuarios(cerrarSesiones);

// Cada minuto: así se ve quién sigue en línea sin recargar.
export const useAccesos = (filtros, habilitado) =>
  useQuery({
    queryKey: ['accesos', filtros],
    queryFn: () => obtenerAccesos(filtros),
    enabled: habilitado,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
