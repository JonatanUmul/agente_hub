import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import {
  cambiarActivoPauta,
  crearPauta,
  editarPauta,
  listarPautas,
  listarPautasResumen,
} from './api.js';

export const usePautasResumen = () =>
  useQuery({ queryKey: ['pautas', 'resumen'], queryFn: listarPautasResumen });
export const usePautas = () => useQuery({ queryKey: ['pautas', 'lista'], queryFn: listarPautas });

// Una pauta cambia el descuento vigente de sus productos: también recargamos productos y multimedia.
const RECARGAR = [['pautas'], ['productos'], ['multimedia']];
export const useCrearPauta = () => useMutacionQueRecarga(crearPauta, RECARGAR);
export const useEditarPauta = () => useMutacionQueRecarga(editarPauta, RECARGAR);
export const useCambiarActivoPauta = () => useMutacionQueRecarga(cambiarActivoPauta, RECARGAR);
