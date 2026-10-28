import { z } from 'zod';

// Piezas de validación que usan varios módulos.

export const fechaIso = z.iso.datetime({ offset: true });

// Recorta, quita vacíos y repetidos. No cambia mayúsculas (el bot puede depender de ellas).
export const listaDeTextos = z
  .array(z.string().trim().max(100))
  .max(100)
  .transform((lista) => [...new Set(lista.filter(Boolean))]);

// numeric(p,2) guarda 2 decimales; más se redondearía en silencio.
// La tolerancia absorbe errores de punto flotante (0.1 * 100 = 10.000000000000002).
export const conDosDecimales = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
export const conUnDecimal = (n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6;

// Etiquetas (<b>, </p>, <br/>) o entidades (&nbsp;, &#39;). El bot recibe texto plano: el HTML de la
// tienda web llegaría tal cual al cliente. Un "<" suelto ("< 2 litros") no es HTML y se permite.
const HTML = /<\/?[a-z][^>]*>|&(#\d+|[a-z]+);/i;
export const sinHtml = (texto) => !HTML.test(texto);
const MENSAJE_HTML = 'Sin HTML: escribe texto simple';

export const porcentaje = z
  .number('Debe ser un número')
  .min(0, 'Mínimo 0')
  .max(100, 'Máximo 100')
  .refine(conDosDecimales, 'Máximo 2 decimales');

export const textoRequerido = (max) => z.string().trim().min(1, 'Requerido').max(max);
export const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((t) => (t ? t : null));
// Igual, pero rechaza HTML (textos que el bot le repite al cliente).
export const textoPlanoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .refine(sinHtml, MENSAJE_HTML)
    .nullable()
    .transform((t) => (t ? t : null));
export const textoPlano = (max) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).refine(sinHtml, MENSAJE_HTML);

export const orden = z
  .number('Debe ser un número')
  .int('Debe ser entero')
  .min(-1_000_000)
  .max(1_000_000);

// `version` = actualizado_en de la fila; detecta si otra persona guardó mientras editabas.
export const version = z.string().min(1);

// Estado calculado con la misma condición de vigencia que las vistas y eco_contexto().
export const ESTADOS_VIGENCIA = ['vigente', 'programada', 'vencida', 'inactiva'];

// Si hay ambas fechas, "hasta" debe ser posterior a "desde" (CHECK en eco_pautas; en eco_reglas_bot
// la base no lo valida, pero una regla así nunca estaría vigente).
export const vigenciaValida = (d) =>
  !d.vigenteDesde || !d.vigenteHasta || new Date(d.vigenteHasta) > new Date(d.vigenteDesde);
export const errorVigencia = {
  path: ['vigenteHasta'],
  message: 'Debe ser posterior a "vigente desde"',
};
