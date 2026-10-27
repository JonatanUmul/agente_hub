import { z } from 'zod';
import {
  ESTADOS_VIGENCIA,
  errorVigencia,
  fechaIso,
  listaDeTextos,
  porcentaje,
  textoOpcional,
  textoRequerido,
  vigenciaValida,
  version,
} from './comunes.js';

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

export const esquemaCrearPauta = z
  .object({ codigo: textoRequerido(100), ...camposEditables })
  .refine(vigenciaValida, errorVigencia);

// El código no se cambia después de crear: el bot lo usa para identificar la pauta.
export const esquemaEditarPauta = z
  .object({ ...camposEditables, version })
  .refine(vigenciaValida, errorVigencia);
