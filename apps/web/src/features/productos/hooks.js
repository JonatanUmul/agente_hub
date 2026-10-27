import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import { cambiarActivoProducto, editarProducto, listarProductos } from './api.js';

const CLAVE = ['productos'];

export const useProductos = () => useQuery({ queryKey: CLAVE, queryFn: listarProductos });
// Los conteos de productos por pauta también cambian.
export const useEditarProducto = () => useMutacionQueRecarga(editarProducto, [CLAVE, ['pautas']]);
export const useCambiarActivoProducto = () =>
  useMutacionQueRecarga(cambiarActivoProducto, [CLAVE, ['pautas']]);
