import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cambiarActivoProducto, editarProducto, listarProductos } from './api.js';

const CLAVE = ['productos'];

export const useProductos = () => useQuery({ queryKey: CLAVE, queryFn: listarProductos });

// Ante un 409 (otra persona guardó antes) también recargamos, para que se vea la versión nueva.
function useMutacionProductos(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLAVE }),
  });
}

export const useEditarProducto = () => useMutacionProductos(editarProducto);
export const useCambiarActivoProducto = () => useMutacionProductos(cambiarActivoProducto);
