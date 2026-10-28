import { z } from 'zod';
import {
  conDosDecimales,
  conUnDecimal,
  fechaIso,
  listaDeTextos,
  orden,
  porcentaje,
  textoPlano,
  textoPlanoOpcional,
  version,
} from './comunes.js';

// Valores permitidos por los CHECK de eco_productos.
export const TIPOS_PRODUCTO = ['equipo', 'accesorio', 'repuesto'];
export const ESTADOS_PRODUCTO = ['disponible', 'agotado', 'descontinuado'];

// Ficha del producto (columnas opcionales de eco_productos). El bot la usa cuando el cliente pregunta
// por el detalle; los campos vacíos no le llegan.
export const CAMPOS_FICHA = [
  'descripcionCorta',
  'descripcion',
  'caracteristicas',
  'material',
  'capacidadTexto',
  'capacidadPurificadorLitros',
  'tasaFiltrado',
  'anchoCm',
  'altoCm',
  'largoCm',
  'pesoLb',
  'compatibleCon',
  'urlWeb',
];
export const MAX_CARACTERISTICAS = 12;
export const URL_TIENDA = 'https://ecofiltro.com.gt/';

// numeric(6,1): hasta 99999.9. Se piden positivos: 0 cm no es una medida.
const medidaCm = z
  .number('Debe ser un número')
  .positive('Debe ser mayor que 0')
  .max(99_999.9, 'Demasiado alto')
  .refine(conUnDecimal, 'Máximo 1 decimal')
  .nullable();

// La columna (numeric(6,2)) admite 2 decimales, pero la ficha pide 1 como las medidas.
const pesoLb = z
  .number('Debe ser un número')
  .positive('Debe ser mayor que 0')
  .max(9_999.9, 'Demasiado alto')
  .refine(conUnDecimal, 'Máximo 1 decimal')
  .nullable();

// numeric(6,2): 10 o 1.5 litros.
const capacidadPurificador = z
  .number('Debe ser un número')
  .positive('Debe ser mayor que 0')
  .max(9_999.99, 'Demasiado alto')
  .refine(conDosDecimales, 'Máximo 2 decimales')
  .nullable();

export function esUrlDeLaTienda(texto) {
  try {
    const url = new URL(texto);
    return texto.startsWith(URL_TIENDA) && url.hostname === 'ecofiltro.com.gt';
  } catch {
    return false;
  }
}

const urlWeb = z
  .string()
  .trim()
  .max(500, 'Máximo 500 caracteres')
  .refine((t) => t === '' || esUrlDeLaTienda(t), `Debe empezar con ${URL_TIENDA}`)
  .nullable()
  .transform((t) => (t ? t : null));

// Un dato por elemento, en el orden en que el bot los dirá. Sin vacíos ni repetidos.
const caracteristicas = z
  .array(textoPlano(200))
  .max(MAX_CARACTERISTICAS, `Máximo ${MAX_CARACTERISTICAS} características`)
  .transform((lista) => [...new Set(lista.filter(Boolean))]);

const camposFicha = {
  descripcionCorta: textoPlanoOpcional(300),
  descripcion: textoPlanoOpcional(3000),
  caracteristicas,
  material: textoPlanoOpcional(200),
  capacidadTexto: textoPlanoOpcional(50),
  capacidadPurificadorLitros: capacidadPurificador,
  tasaFiltrado: textoPlanoOpcional(100),
  anchoCm: medidaCm,
  altoCm: medidaCm,
  largoCm: medidaCm,
  pesoLb,
  compatibleCon: textoPlanoOpcional(500),
  urlWeb,
};

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
  // Pautas asociadas (puede haber varias). `vigente` = activa y dentro de sus fechas.
  pautas: z.array(
    z.object({
      id: z.number().int(),
      codigo: z.string(),
      nombre: z.string(),
      descuentoPct: z.number().nullable(),
      vigente: z.boolean(),
    }),
  ),
  // Descuento que aplica hoy según eco_v_catalogo; null si el producto está inactivo (el bot no lo ve).
  descuentoVigentePct: z.number().nullable(),
  precioFinal: z.number().nullable(),
  wooId: z.number().int().nullable(),
  palabrasClave: z.array(z.string()),
  orden: z.number().int(),
  activo: z.boolean(),
  descripcionCorta: z.string().nullable(),
  descripcion: z.string().nullable(),
  caracteristicas: z.array(z.string()),
  material: z.string().nullable(),
  capacidadTexto: z.string().nullable(),
  capacidadPurificadorLitros: z.number().nullable(),
  tasaFiltrado: z.string().nullable(),
  anchoCm: z.number().nullable(),
  altoCm: z.number().nullable(),
  largoCm: z.number().nullable(),
  pesoLb: z.number().nullable(),
  compatibleCon: z.string().nullable(),
  urlWeb: z.string().nullable(),
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
  // Sin repetidos y ordenadas, para comparar sin importar el orden en que se marcaron.
  pautaIds: z
    .array(z.number().int().positive())
    .max(50)
    .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
  orden,
  activo: z.boolean(),
  // Qué campos aplican a cada tipo (purificador, compatibilidad) lo valida el service: el tipo no viaja en el formulario.
  ...camposFicha,
  version,
});

// Activar / desactivar desde una tabla (productos, pautas, multimedia).
export const esquemaCambiarActivo = z.object({ activo: z.boolean(), version });
