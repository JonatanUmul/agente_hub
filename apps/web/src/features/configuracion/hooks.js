import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import {
  cambiarInterruptor,
  cambiarParametro,
  cambiarTexto,
  listarInterruptores,
  listarParametros,
  listarTextos,
} from './api.js';

const CLAVE = ['interruptores'];

export const useInterruptores = () => useQuery({ queryKey: CLAVE, queryFn: listarInterruptores });

// Mapa { precios_habilitados: true, ... } para preguntar rápido por un interruptor.
export function useEstadoInterruptores() {
  const consulta = useInterruptores();
  const estado = Object.fromEntries((consulta.data ?? []).map((i) => [i.clave, i.habilitado]));
  return { ...consulta, estado };
}

export function useCambiarInterruptor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cambiarInterruptor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE }),
  });
}

const CLAVE_PARAMETROS = ['parametros'];
export const useParametros = () =>
  useQuery({ queryKey: CLAVE_PARAMETROS, queryFn: listarParametros });
export const useCambiarParametro = () =>
  useMutacionQueRecarga(cambiarParametro, [CLAVE_PARAMETROS]);

const CLAVE_TEXTOS = ['configuracion-textos'];
export const useTextosConfiguracion = () =>
  useQuery({ queryKey: CLAVE_TEXTOS, queryFn: listarTextos });
export const useCambiarTexto = () => useMutacionQueRecarga(cambiarTexto, [CLAVE_TEXTOS]);
