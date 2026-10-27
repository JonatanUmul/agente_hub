import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import {
  cambiarActivoPregunta,
  crearPregunta,
  editarPregunta,
  listarPreguntas,
  obtenerSiguienteNumero,
} from './api.js';

const CLAVE = ['preguntas'];

export const usePreguntas = () => useQuery({ queryKey: CLAVE, queryFn: listarPreguntas });
// staleTime 0: el número sugerido siempre se pide fresco al abrir el formulario.
export const useSiguienteNumero = (habilitado) =>
  useQuery({
    queryKey: [...CLAVE, 'siguiente'],
    queryFn: obtenerSiguienteNumero,
    enabled: habilitado,
    staleTime: 0,
  });
export const useCrearPregunta = () => useMutacionQueRecarga(crearPregunta, [CLAVE]);
export const useEditarPregunta = () => useMutacionQueRecarga(editarPregunta, [CLAVE]);
export const useCambiarActivoPregunta = () => useMutacionQueRecarga(cambiarActivoPregunta, [CLAVE]);
