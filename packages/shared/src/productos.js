import { z } from 'zod';
import {
  conDosDecimales,
  conUnDecimal,
  fechaIso,
  listaDeTextos,
  orden,
  porcentaje,
  sinHtml,
  textoPlano,
  textoPlanoOpcional,
  version,
  listaDeIds,
} from './comunes.js';
import { camposVision } from './vision.js';

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

// ItemCode: el bot nombra el producto con él ([[PRECIO:CODIGO]], fotos, pautas). Se guarda en
// mayúsculas y sin espacios para que dos formas de escribirlo no parezcan códigos distintos.
export const normalizarItemCode = (texto) =>
  String(texto ?? '')
    .toUpperCase()
    .replace(/\s+/g, '');

export const itemCode = z
  .string('Requerido')
  .transform(normalizarItemCode)
  .pipe(
    z
      .string()
      .min(1, 'Requerido')
      .max(50, 'Máximo 50 caracteres')
      .regex(/^[A-Z0-9.-]+$/, 'Solo letras sin tilde (A-Z), números, guion y punto'),
  );

// ¿El texto nombra el código? Sin importar mayúsculas y como palabra completa: «LLAVE» no aparece en
// «LLAVE-2», pero sí en «[[PRECIO:LLAVE]]» o al final de una oración («…la LLAVE.»).
const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const mencionaCodigo = (texto, codigo) =>
  typeof texto === 'string' &&
  new RegExp(`(?<![A-Z0-9.-])${escaparRegex(codigo)}(?![A-Z0-9-]|\\.[A-Z0-9])`, 'i').test(texto);

const textoRequeridoPlano = (max) =>
  z
    .string('Requerido')
    .trim()
    .min(1, 'Requerido')
    .max(max, `Máximo ${max} caracteres`)
    .refine(sinHtml, 'Sin HTML: escribe texto simple');
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
  variante: z.string().nullable(),
  nombreCorto: z.string().nullable(),
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
  // Colores de las imágenes activas del producto en eco_multimedia (para avisar colores sin foto).
  coloresConFoto: z.array(z.string()),
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
  pistasVisuales: z.string().nullable(),
  fotosReferencia: z.array(z.object({ url: z.string(), color: z.string().nullable() })),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  // Para detectar si otra persona guardó el producto mientras lo editabas.
  version: z.string(),
});

// Campos que se escriben tanto al crear como al editar.
const camposEditables = {
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
  pautaIds: listaDeIds,
  orden,
  activo: z.boolean(),
  // Estilo dentro de la familia («Flor Azul») y cómo lo nombra el bot en una lista («Cerámica Flor Azul»).
  variante: textoPlanoOpcional(100),
  nombreCorto: textoPlanoOpcional(150),
  // Qué campos aplican a cada tipo (purificador, compatibilidad) lo valida el service.
  ...camposFicha,
  ...camposVision,
};

export const esquemaEditarProducto = z.object({
  // Sin normalizar: un código viejo que no sigue el formato se puede seguir guardando tal cual.
  // Si cambia, el service lo valida con `itemCode`.
  codigo: z.string().trim().min(1, 'Requerido').max(100),
  ...camposEditables,
  // Cambiar el ItemCode exige que la persona haya visto a qué afecta (paso de confirmación).
  confirmarCambioCodigo: z.boolean().optional(),
  version,
});

// Sin `.refine` para que el formulario pueda extenderlo (Zod 4 no permite extender objetos refinados).
export const esquemaDatosProductoNuevo = z.object({
  codigo: itemCode,
  nombre: textoRequeridoPlano(200),
  tipo: z.enum(TIPOS_PRODUCTO, 'Elige un tipo'),
  familia: textoRequeridoPlano(100),
  capacidadLitros: z
    .number('Debe ser un número')
    .positive('Debe ser mayor que 0')
    .max(9_999.99, 'Demasiado alto')
    .refine(conDosDecimales, 'Máximo 2 decimales')
    .nullable(),
  ...camposEditables,
});

// Un producto nuevo necesita precio, salvo que nazca descontinuado (solo se registra, no se vende).
export const tienePrecioSiLoNecesita = (d) => d.estado === 'descontinuado' || d.precioBase !== null;
export const errorPrecioRequerido = {
  path: ['precioBase'],
  message: 'Requerido, salvo que el estado sea «descontinuado»',
};

export const esquemaCrearProducto = esquemaDatosProductoNuevo.refine(
  tienePrecioSiLoNecesita,
  errorPrecioRequerido,
);

// A qué afecta cambiar el ItemCode de un producto (paso de confirmación).
export const esquemaImpactoCodigo = z.object({
  // Otro producto (activo o no) que ya usa ese código sin importar mayúsculas.
  conflicto: z
    .object({ id: z.number().int(), codigo: z.string(), nombre: z.string(), activo: z.boolean() })
    .nullable(),
  // Filas que apuntan al producto por producto_id: no se rompen, se informan.
  dependencias: z.object({
    multimedia: z.number().int(),
    productosPautas: z.number().int(),
    multimediaPautas: z.number().int(),
  }),
  // Textos que escriben el código viejo: esos sí quedan desactualizados y hay que editarlos a mano.
  menciones: z.array(
    z.object({
      tabla: z.string(),
      id: z.number().int(),
      etiqueta: z.string(),
      activo: z.boolean(),
    }),
  ),
});

// Activar / desactivar desde una tabla (productos, pautas, multimedia).
export const esquemaCambiarActivo = z.object({ activo: z.boolean(), version });
