import { z } from 'zod';
import {
  ESTADOS_VIGENCIA,
  errorVigencia,
  fechaIso,
  textoRequerido,
  vigenciaValida,
  version,
} from './comunes.js';

// Valores permitidos por los CHECK de eco_reglas_bot.
export const MODULOS = ['GLOBAL', 'SAC', 'COMPRA', 'DISTRIBUIDOR', 'PAUTAS'];
export const DESTINOS = ['TODOS', 'ENRUTADOR', 'REDACTOR'];

export const esquemaRegla = z.object({
  id: z.number().int(),
  codigo: z.string(),
  modulo: z.enum(MODULOS),
  destino: z.enum(DESTINOS),
  categoria: z.string(),
  titulo: z.string(),
  regla: z.string(),
  prioridad: z.number().int(),
  activo: z.boolean(),
  vigenteDesde: fechaIso.nullable(),
  vigenteHasta: fechaIso.nullable(),
  vigente: z.boolean(),
  estadoVigencia: z.enum(ESTADOS_VIGENCIA),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

const camposEditables = {
  modulo: z.enum(MODULOS),
  destino: z.enum(DESTINOS),
  categoria: textoRequerido(100),
  titulo: textoRequerido(200),
  regla: textoRequerido(10_000),
  prioridad: z.number('Debe ser un número').int('Debe ser entero').min(-100_000).max(100_000),
  activo: z.boolean(),
  vigenteDesde: fechaIso.nullable(),
  vigenteHasta: fechaIso.nullable(),
};

// El código no se cambia después de crear: eco_contexto() lo entrega al bot.
export const esquemaCrearRegla = z
  .object({ codigo: textoRequerido(100), ...camposEditables })
  .refine(vigenciaValida, errorVigencia);

export const esquemaEditarRegla = z
  .object({ ...camposEditables, version })
  .refine(vigenciaValida, errorVigencia);

// En qué llamadas a eco_contexto(modulo) aparece una regla: las GLOBAL en todas, las demás solo
// en la de su módulo. Solo si está activa y vigente (vista eco_v_reglas_activas).
export function contextosDeRegla({ modulo, vigente }) {
  if (!vigente) return [];
  return modulo === 'GLOBAL' ? [...MODULOS] : [modulo];
}
