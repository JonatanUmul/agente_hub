import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import {
  cambiarActivoSaludo,
  crearSaludo,
  editarSaludo,
  eliminarSaludo,
  guardarTextoMenu,
  leerTextoMenu,
  listarSaludos,
  saludoVigente,
  simularSaludo,
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
export const useSimulacion = (consulta) =>
  useQuery({
    queryKey: [...CLAVE, 'simular', consulta],
    queryFn: () => simularSaludo(consulta),
    enabled: Boolean(consulta),
  });
export const useTextoMenu = () =>
  useQuery({ queryKey: [...CLAVE, 'menu'], queryFn: leerTextoMenu });

export const useCrearSaludo = () => useMutacionQueRecarga(crearSaludo, [CLAVE]);
export const useEditarSaludo = () => useMutacionQueRecarga(editarSaludo, [CLAVE]);
export const useCambiarActivoSaludo = () => useMutacionQueRecarga(cambiarActivoSaludo, [CLAVE]);
export const useEliminarSaludo = () => useMutacionQueRecarga(eliminarSaludo, [CLAVE]);
export const useGuardarTextoMenu = () => useMutacionQueRecarga(guardarTextoMenu, [CLAVE]);
