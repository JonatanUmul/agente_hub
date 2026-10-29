import { useQuery } from '@tanstack/react-query';
import { useMutacionQueRecarga } from '../../lib/mutaciones.js';
import {
  cambiarActivoMensaje,
  crearMensaje,
  editarMensaje,
  eliminarMensaje,
  listarMensajes,
  reordenarMensajes,
} from './api.js';

export const CLAVE_MENSAJES = ['mensajes'];
const recargar = [CLAVE_MENSAJES];

export const useMensajes = () => useQuery({ queryKey: CLAVE_MENSAJES, queryFn: listarMensajes });
export const useCrearMensaje = () => useMutacionQueRecarga(crearMensaje, recargar);
export const useEditarMensaje = () => useMutacionQueRecarga(editarMensaje, recargar);
export const useCambiarActivoMensaje = () => useMutacionQueRecarga(cambiarActivoMensaje, recargar);
export const useEliminarMensaje = () => useMutacionQueRecarga(eliminarMensaje, recargar);
export const useReordenarMensajes = () => useMutacionQueRecarga(reordenarMensajes, recargar);
