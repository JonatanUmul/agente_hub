import { z } from 'zod';
import { conDosDecimales, fechaIso, listaDeTextos, orden, porcentaje, version } from './comunes.js';

// Valores permitidos por los CHECK de eco_productos.
export const TIPOS_PRODUCTO = ['equipo', 'accesorio', 'repuesto'];
export const ESTADOS_PRODUCTO = ['disponible', 'agotado', 'descontinuado'];

export const esquemaProducto = z.object({
  id: z.number().int(),
  codigo: z.string(),
  nombre: z.string(),
  tipo: z.enum(TIPOS_PRODUCTO),
  familia: z.string(),
  capacidadLitros: z.number().nullable(),
  colores: z.array(z.string()),
  estado: z.enum(ESTADOS_PRODUCTO),
  precioBase: z.number().nullable(),
  descuentoPct: z.number(),
  pauta: z
    .object({
      id: z.number().int(),
      codigo: z.string(),
      nombre: z.string(),
      descuentoPct: z.number().nullable(),
      vigente: z.boolean(),
    })
    .nullable(),
  // Descuento que aplica hoy según eco_v_catalogo; null si el producto está inactivo (el bot no lo ve).
  descuentoVigentePct: z.number().nullable(),
  precioFinal: z.number().nullable(),
  wooId: z.number().int().nullable(),
  palabrasClave: z.array(z.string()),
  orden: z.number().int(),
  activo: z.boolean(),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  // Para detectar si otra persona guardó el producto mientras lo editabas.
  version: z.string(),
});

export const esquemaEditarProducto = z.object({
  precioBase: z
    .number('Debe ser un número')
    .min(0, 'No puede ser negativo')
    .max(99_999_999.99, 'Demasiado alto')
    .refine(conDosDecimales, 'Máximo 2 decimales')
    .nullable(),
  descuentoPct: porcentaje,
  estado: z.enum(ESTADOS_PRODUCTO),
  colores: listaDeTextos,
  palabrasClave: listaDeTextos,
  pautaId: z.number().int().positive().nullable(),
  orden,
  activo: z.boolean(),
  version,
});

// Activar / desactivar desde una tabla (productos, pautas, multimedia).
export const esquemaCambiarActivo = z.object({ activo: z.boolean(), version });
