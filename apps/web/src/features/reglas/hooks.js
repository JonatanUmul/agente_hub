import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import { cambiarActivoRegla, crearRegla, editarRegla, listarReglas } from './api.js';

const CLAVE = ['reglas'];

export const useReglas = () => useQuery({ queryKey: CLAVE, queryFn: listarReglas });
export const useCrearRegla = () => useMutacionQueRecarga(crearRegla, [CLAVE]);
export const useEditarRegla = () => useMutacionQueRecarga(editarRegla, [CLAVE]);
export const useCambiarActivoRegla = () => useMutacionQueRecarga(cambiarActivoRegla, [CLAVE]);
