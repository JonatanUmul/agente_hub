import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import {
  cambiarActivoFrase,
  cambiarCierreAutomatico,
  crearFrase,
  editarFrase,
  eliminarFrase,
  listarFrases,
  reordenarFrases,
} from './api.js';

export const CLAVE_FRASES = ['frases-cierre'];
const recargar = [CLAVE_FRASES];

export const useFrases = () => useQuery({ queryKey: CLAVE_FRASES, queryFn: listarFrases });
export const useCrearFrase = () => useMutacionQueRecarga(crearFrase, recargar);
export const useEditarFrase = () => useMutacionQueRecarga(editarFrase, recargar);
export const useCambiarActivoFrase = () => useMutacionQueRecarga(cambiarActivoFrase, recargar);
export const useEliminarFrase = () => useMutacionQueRecarga(eliminarFrase, recargar);
export const useReordenarFrases = () => useMutacionQueRecarga(reordenarFrases, recargar);
// El interruptor vive con los demás de eco_configuracion.
export const useCambiarCierreAutomatico = () =>
  useMutacionQueRecarga(cambiarCierreAutomatico, [['interruptores']]);
