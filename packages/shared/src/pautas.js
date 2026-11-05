import { z } from 'zod';
import {
  ESTADOS_VIGENCIA,
  errorVigencia,
  fechaIso,
  listaDeIds,
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
  // Para todos los modelos (formas de pago, beneficios generales): n8n ofrece todos los equipos disponibles.
  aplicaTodos: z.boolean(),
  // eco_productos_pautas y eco_multimedia_pautas, también los inactivos.
  productoIds: z.array(z.number().int()),
  multimediaIds: z.array(z.number().int()),
});

export const esquemaPauta = esquemaPautaResumen.extend({
  mensajeCliente: z.string().nullable(),
  palabrasClave: z.array(z.string()),
  vigenteDesde: fechaIso.nullable(),
  vigenteHasta: fechaIso.nullable(),
  estadoVigencia: z.enum(ESTADOS_VIGENCIA),
  productosActivos: z.number().int(),
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
  aplicaTodos: z.boolean(),
  // Con `aplicaTodos` los modelos se conservan sin tocar, para que vuelvan si se apaga.
  productoIds: listaDeIds,
  multimediaIds: listaDeIds,
};

export const esquemaCrearPauta = z
  .object({ codigo: textoRequerido(100), ...camposEditables })
  .refine(vigenciaValida, errorVigencia);

// El código no se cambia después de crear: el bot lo usa para identificar la pauta.
export const esquemaEditarPauta = z
  .object({ ...camposEditables, version })
  .refine(vigenciaValida, errorVigencia);

// Otras pautas vigentes con descuento del producto: el bot usa el descuento mayor.
export const otrasPautasConDescuento = (producto, pautaId) =>
  producto.pautas.filter((pa) => pa.id !== pautaId && pa.vigente && pa.descuentoPct > 0);
