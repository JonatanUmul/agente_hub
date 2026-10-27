import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import { cambiarActivoArchivo, crearArchivo, editarArchivo, listarArchivos } from './api.js';

const CLAVE = ['multimedia'];

export const useArchivos = () => useQuery({ queryKey: CLAVE, queryFn: listarArchivos });
// Los conteos de archivos por pauta también cambian.
const RECARGAR = [CLAVE, ['pautas']];
export const useCrearArchivo = () => useMutacionQueRecarga(crearArchivo, RECARGAR);
export const useEditarArchivo = () => useMutacionQueRecarga(editarArchivo, RECARGAR);
export const useCambiarActivoArchivo = () => useMutacionQueRecarga(cambiarActivoArchivo, RECARGAR);
