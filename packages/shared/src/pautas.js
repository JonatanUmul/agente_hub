import { z } from 'zod';
import {
  fechaIso,
  listaDeTextos,
  porcentaje,
  textoOpcional,
  textoRequerido,
  version,
} from './comunes.js';

// Estado calculado con la misma condición de vigencia que eco_v_catalogo y eco_contexto().
export const ESTADOS_VIGENCIA = ['vigente', 'programada', 'vencida', 'inactiva'];

// Resumen para selectores (producto, multimedia).
export const esquemaPautaResumen = z.object({
  id: z.number().int(),
  codigo: z.string(),
  nombre: z.string(),
  descuentoPct: z.number().nullable(),
  activo: z.boolean(),
  vigente: z.boolean(),
});

export const esquemaPauta = esquemaPautaResumen.extend({
  mensajeCliente: z.string().nullable(),
  palabrasClave: z.array(z.string()),
  vigenteDesde: fechaIso.nullable(),
  vigenteHasta: fechaIso.nullable(),
  estadoVigencia: z.enum(ESTADOS_VIGENCIA),
  productosActivos: z.number().int(),
  // Productos con descuento propio que lo pierden mientras la pauta no esté vigente (regla de eco_v_catalogo).
  productosConDescuentoPropio: z.number().int(),
  archivosActivos: z.number().int(),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

const camposEditables = {
  nombre: textoRequerido(200),
  mensajeCliente: textoOpcional(2000),
  descuentoPct: porcentaje.nullable(),
  palabrasClave: listaDeTextos,
  vigenteDesde: fechaIso.nullable(),
  vigenteHasta: fechaIso.nullable(),
  activo: z.boolean(),
};

// Mismo CHECK que eco_pautas: si hay ambas fechas, "hasta" debe ser posterior a "desde".
const vigenciaValida = (d) =>
  !d.vigenteDesde || !d.vigenteHasta || new Date(d.vigenteHasta) > new Date(d.vigenteDesde);
const errorVigencia = { path: ['vigenteHasta'], message: 'Debe ser posterior a "vigente desde"' };

export const esquemaCrearPauta = z
  .object({ codigo: textoRequerido(100), ...camposEditables })
  .refine(vigenciaValida, errorVigencia);

// El código no se cambia después de crear: el bot lo usa para identificar la pauta.
export const esquemaEditarPauta = z
  .object({ ...camposEditables, version })
  .refine(vigenciaValida, errorVigencia);
