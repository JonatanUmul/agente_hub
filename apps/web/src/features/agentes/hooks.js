import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import { agregarDescanso, guardarHorario, listarAgentes, quitarDescanso } from './api.js';

const CLAVE = ['agentes'];

// Cada minuto: "en horario ahora" cambia con la hora aunque nadie edite nada.
export const useAgentes = () =>
  useQuery({ queryKey: CLAVE, queryFn: listarAgentes, refetchInterval: 60_000 });
export const useGuardarHorario = () => useMutacionQueRecarga(guardarHorario, [CLAVE]);
export const useAgregarDescanso = () => useMutacionQueRecarga(agregarDescanso, [CLAVE]);
export const useQuitarDescanso = () => useMutacionQueRecarga(quitarDescanso, [CLAVE]);
