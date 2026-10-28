import { z } from 'zod';
import { fechaIso, orden, version } from './comunes.js';

// Frases con que el bot cierra sus mensajes (eco_frases_cierre). n8n elige una al azar, sin repetir en la
// conversación, entre las activas de GLOBAL + el módulo de la conversación y de la situación de la respuesta.

// Valores permitidos por los CHECK de eco_frases_cierre.
export const MODULOS_FRASE = ['GLOBAL', 'COMPRA', 'SAC', 'DISTRIBUIDOR'];
export const SITUACIONES_FRASE = ['general', 'producto', 'problema'];

export const NOMBRES_MODULO_FRASE = {
  GLOBAL: 'General (todos)',
  COMPRA: 'Compras',
  SAC: 'Atención al cliente',
  DISTRIBUIDOR: 'Distribuidores',
};
export const INFO_SITUACIONES = {
  general: { titulo: 'General', cuando: 'El resto de los casos.' },
  producto: {
    titulo: 'Después de un producto',
    cuando: 'La respuesta habló de un modelo, color o accesorio.',
  },
  problema: {
    titulo: 'Después de un problema',
    cuando: 'La respuesta ayudó con una falla, garantía o pedido.',
  },
};

// Los bots que usan las frases: cada uno lee GLOBAL + su módulo.
export const BOTS_CON_CIERRE = { COMPRA: 'compras', SAC: 'atención al cliente' };
export const FRASES_RECOMENDADAS = 3;
// Regla del redactor que dice que la IA ya no escribe el cierre: su ficha enlaza a Frases de cierre.
export const REGLA_CIERRE = 'REDACCION-CIERRE';
export const EMOJIS_FRASE = ['😊', '💧', '🙌', '✨', '👍', '💙', '🛠️', '🙏', '✅'];

export const MIN_FRASE = 3;
export const MAX_FRASE = 200;

// Largo en caracteres como lo cuenta PostgreSQL (puntos de código): un emoji 😊 cuenta 1, no 2.
export const largoFrase = (texto) => [...texto].length;

// El bot pega la frase tal cual en WhatsApp: Markdown se vería como símbolos sueltos.
// Se permiten *negrita* y _cursiva_ de WhatsApp (un solo símbolo); no **, #, __, ~~, `, [enlace](url)
// ni viñetas o citas al inicio.
const MARKDOWN = [/\*\*/, /#/, /__/, /~~/, /`/, /\[[^\]]*\]\([^)]*\)/, /^\s*([-+>]|\d+\.)\s/];
export const tieneMarkdown = (texto) => MARKDOWN.some((patron) => patron.test(texto));

const frase = z
  .string()
  .trim()
  .refine((t) => largoFrase(t) >= MIN_FRASE, `Mínimo ${MIN_FRASE} caracteres`)
  .refine((t) => largoFrase(t) <= MAX_FRASE, `Máximo ${MAX_FRASE} caracteres`)
  .refine((t) => !/[\r\n]/.test(t), 'Debe ser una sola línea')
  .refine((t) => !tieneMarkdown(t), 'Sin Markdown: nada de **, #, __, `, enlaces ni viñetas');

export const esquemaFrase = z.object({
  id: z.number().int(),
  modulo: z.enum(MODULOS_FRASE),
  situacion: z.enum(SITUACIONES_FRASE),
  frase: z.string(),
  activo: z.boolean(),
  orden: z.number().int(),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

const camposEditables = {
  modulo: z.enum(MODULOS_FRASE),
  situacion: z.enum(SITUACIONES_FRASE),
  frase,
  activo: z.boolean(),
};

export const esquemaCrearFrase = z.object(camposEditables);
export const esquemaEditarFrase = z.object({ ...camposEditables, version });
export const esquemaEliminarFrase = z.object({ version });

const vacioAUndefined = (v) => (v === '' ? undefined : v);
export const esquemaFiltrosFrases = z.object({
  modulo: z.preprocess(vacioAUndefined, z.enum(MODULOS_FRASE).optional()),
  situacion: z.preprocess(vacioAUndefined, z.enum(SITUACIONES_FRASE).optional()),
  activo: z.preprocess(vacioAUndefined, z.enum(['true', 'false']).optional()),
});

// Reordenar un grupo (mismo módulo y situación): la lista completa con su nuevo orden.
export const esquemaReordenarFrases = z
  .array(z.object({ id: z.number().int().positive(), orden }))
  .min(1)
  .max(200)
  .refine((l) => new Set(l.map((f) => f.id)).size === l.length, 'Hay frases repetidas');

// Nuevo orden de un grupo a partir de los ids en el orden deseado: 10, 20, 30… deja espacio entre frases.
export const ordenarGrupo = (ids) => ids.map((id, i) => ({ id, orden: (i + 1) * 10 }));

// Frases que recibe el bot de un módulo para una situación, igual que n8n: activas de GLOBAL + el módulo,
// ordenadas por orden e id; si no hay de esa situación, usa las de `general`.
export function frasesParaElBot(frases, modulo, situacion) {
  const delModulo = frases
    .filter((f) => f.activo && (f.modulo === 'GLOBAL' || f.modulo === modulo))
    .sort((a, b) => a.orden - b.orden || a.id - b.id);
  const propias = delModulo.filter((f) => f.situacion === situacion);
  return propias.length ? propias : delModulo.filter((f) => f.situacion === 'general');
}

// Bots que se quedarían sin cierre en la mayoría de los mensajes: sin frases `general` activas (ni propias
// ni GLOBAL). Devuelve [{ modulo, bot }].
export const botsSinFrasesGenerales = (frases) =>
  Object.entries(BOTS_CON_CIERRE)
    .filter(
      ([modulo]) =>
        !frases.some(
          (f) =>
            f.activo && f.situacion === 'general' && (f.modulo === 'GLOBAL' || f.modulo === modulo),
        ),
    )
    .map(([modulo, bot]) => ({ modulo, bot }));

// Conteo de frases activas por módulo y situación (para el dashboard).
export function resumenFrasesActivas(frases) {
  return MODULOS_FRASE.map((modulo) => ({
    modulo,
    ...Object.fromEntries(
      SITUACIONES_FRASE.map((s) => [
        s,
        frases.filter((f) => f.activo && f.modulo === modulo && f.situacion === s).length,
      ]),
    ),
  }));
}

// Mensaje de ejemplo para la vista previa, según la situación.
export const EJEMPLOS_SITUACION = {
  general: 'Puedes hacer tu pedido por este mismo chat.',
  producto: 'Ese modelo está disponible en color azul.',
  problema: 'La garantía dura 2 años para los recipientes 😊',
};
