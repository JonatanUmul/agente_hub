import { z } from 'zod';

// Valores permitidos por los CHECK de eco_productos.
export const TIPOS_PRODUCTO = ['equipo', 'accesorio', 'repuesto'];
export const ESTADOS_PRODUCTO = ['disponible', 'agotado', 'descontinuado'];

// numeric(10,2) y numeric(5,2) guardan 2 decimales; más se redondearía en silencio.
// La tolerancia absorbe errores de punto flotante (0.1 * 100 = 10.000000000000002).
const conDosDecimales = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

// Lista de textos: recorta, quita vacíos y repetidos. No cambia mayúsculas (el bot puede depender de ellas).
const listaDeTextos = z
  .array(z.string().trim().max(100))
  .max(100)
  .transform((lista) => [...new Set(lista.filter(Boolean))]);

const fechaIso = z.iso.datetime({ offset: true });

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
  descuentoPct: z
    .number('Debe ser un número')
    .min(0, 'Mínimo 0')
    .max(100, 'Máximo 100')
    .refine(conDosDecimales, 'Máximo 2 decimales'),
  estado: z.enum(ESTADOS_PRODUCTO),
  colores: listaDeTextos,
  palabrasClave: listaDeTextos,
  pautaId: z.number().int().positive().nullable(),
  orden: z.number('Debe ser un número').int('Debe ser entero').min(-1_000_000).max(1_000_000),
  activo: z.boolean(),
  version: z.string().min(1),
});

export const esquemaCambiarActivoProducto = z.object({
  activo: z.boolean(),
  version: z.string().min(1),
});
