import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import {
  cambiarActivoArchivo,
  crearArchivo,
  crearArtePauta,
  editarArchivo,
  listarArchivos,
} from './api.js';

const CLAVE = ['multimedia'];

export const useArchivos = () => useQuery({ queryKey: CLAVE, queryFn: listarArchivos });
// Las pautas de un archivo se ven también en Pautas y Productos.
const RECARGAR = [CLAVE, ['pautas'], ['productos']];
export const useCrearArchivo = () => useMutacionQueRecarga(crearArchivo, RECARGAR);
export const useEditarArchivo = () => useMutacionQueRecarga(editarArchivo, RECARGAR);
export const useCambiarActivoArchivo = () => useMutacionQueRecarga(cambiarActivoArchivo, RECARGAR);
export const useCrearArtePauta = () => useMutacionQueRecarga(crearArtePauta, RECARGAR);
