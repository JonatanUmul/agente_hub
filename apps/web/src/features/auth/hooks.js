import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tienePermiso } from '@ecofiltro/shared';
import { cambiarContrasena, cerrarSesion, iniciarSesion, obtenerSesion } from './api.js';

export const CLAVE_SESION = ['sesion'];

export const useSesion = () =>
  useQuery({ queryKey: CLAVE_SESION, queryFn: obtenerSesion, staleTime: Infinity, retry: false });

// Solo para mostrar u ocultar controles: la API vuelve a verificar el permiso.
export function usePermiso(permiso) {
  const { data } = useSesion();
  return Boolean(data && tienePermiso(data.usuario.rol, permiso));
}

export function useIniciarSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: iniciarSesion,
    onSuccess: (sesion) => queryClient.setQueryData(CLAVE_SESION, sesion),
  });
}

export function useCerrarSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cerrarSesion,
    // Borra todo lo cacheado: el siguiente usuario no debe ver datos del anterior.
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(CLAVE_SESION, null);
    },
  });
}

export const useCambiarContrasena = () => useMutation({ mutationFn: cambiarContrasena });
