import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearUsuario, editarUsuario, listarUsuarios, restablecerContrasena } from './api.js';

const CLAVE = ['usuarios'];

export const useUsuarios = () => useQuery({ queryKey: CLAVE, queryFn: listarUsuarios });

// Tras cualquier cambio volvemos a pedir la lista: la API es la fuente de verdad.
function useMutacionUsuarios(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE }),
  });
}

export const useCrearUsuario = () => useMutacionUsuarios(crearUsuario);
export const useEditarUsuario = () => useMutacionUsuarios(editarUsuario);
export const useRestablecerContrasena = () => useMutacionUsuarios(restablecerContrasena);
