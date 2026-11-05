import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import { cambiarActivoProducto, editarProducto, listarProductos } from './api.js';

const CLAVE = ['productos'];

export const useProductos = () => useQuery({ queryKey: CLAVE, queryFn: listarProductos });
// Las pautas de un producto se ven también en Pautas y Multimedia.
const RECARGAR = [CLAVE, ['pautas'], ['multimedia']];
export const useEditarProducto = () => useMutacionQueRecarga(editarProducto, RECARGAR);
export const useCambiarActivoProducto = () =>
  useMutacionQueRecarga(cambiarActivoProducto, RECARGAR);
