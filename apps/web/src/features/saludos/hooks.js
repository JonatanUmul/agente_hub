import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import {
  cambiarActivoSaludo,
  crearSaludo,
  editarSaludo,
  eliminarSaludo,
  listarSaludos,
  saludoVigente,
} from './api.js';

const CLAVE = ['saludos'];

export const useSaludos = () => useQuery({ queryKey: CLAVE, queryFn: listarSaludos });
// El saludo de hoy cambia con la hora ({momento}): se refresca cada minuto.
export const useSaludoVigente = (modulo) =>
  useQuery({
    queryKey: [...CLAVE, 'vigente', modulo],
    queryFn: () => saludoVigente(modulo),
    refetchInterval: 60_000,
  });

export const useCrearSaludo = () => useMutacionQueRecarga(crearSaludo, [CLAVE]);
export const useEditarSaludo = () => useMutacionQueRecarga(editarSaludo, [CLAVE]);
export const useCambiarActivoSaludo = () => useMutacionQueRecarga(cambiarActivoSaludo, [CLAVE]);
export const useEliminarSaludo = () => useMutacionQueRecarga(eliminarSaludo, [CLAVE]);
