import { z } from 'zod';
import { fechaIso, orden, version } from './comunes.js';

// Textos fijos del bot (eco_mensajes) por clave del catálogo eco_mensajes_tipos (solo lectura para la app).
// Con varias versiones activas el bot las alterna; sin ninguna activa usa su texto por defecto de n8n.

export const CATEGORIAS_MENSAJE = [
  'Inicio',
  'Asesor',
  'Inactividad',
  'Atención al cliente',
  'Datos no confirmados',
  'Pauta',
];
// Claves que no deberían quedarse sin texto: desactivar o borrar su última versión pide confirmación.
export const MENSAJES_PROTEGIDOS = [
  'menu_bienvenida',
  'inactividad_aviso',
  'inactividad_cierre',
  'asesor_pedir_nombre',
];
export const EMOJIS_MENSAJE = [
  '😊',
  '💧',
  '🙌',
  '🤝',
  '🙏',
  '✨',
  '👍',
  '💙',
  '🛠️',
  '📦',
  '🎄',
  '🎉',
];
export const MIN_MENSAJE = 2;
export const MAX_MENSAJE = 1000;

// El catálogo puede guardar el comodín como 'nombre' o '{nombre}'.
export const nombreComodin = (c) => c.replace(/^\{|\}$/g, '');
const largo = (t) => [...t].length;

// Markdown que WhatsApp mostraría como símbolos. Se permiten saltos de línea y listas (los menús las usan).
const MARKDOWN = [/\*\*/, /__/, /~~/, /`/, /\[[^\]]*\]\([^)]*\)/, /^#{1,6}\s/m];
// *negrita* de WhatsApp: solo en los mensajes de pauta.
const NEGRITA = /\*[^*\s][^*\n]*\*/;

// Errores del texto para un tipo de mensaje (null si es válido). Se usa en la API y en el formulario.
export function errorTextoMensaje(texto, tipo) {
  const t = texto.trim();
  if (largo(t) < MIN_MENSAJE) return `Mínimo ${MIN_MENSAJE} caracteres`;
  if (largo(t) > MAX_MENSAJE) return `Máximo ${MAX_MENSAJE} caracteres`;
  if (MARKDOWN.some((m) => m.test(t))) return 'Sin Markdown: nada de **, __, ~~, `, enlaces ni #';
  if (tipo.categoria !== 'Pauta' && NEGRITA.test(t)) {
    return 'La *negrita* solo se permite en los mensajes de pauta';
  }
  const permitidos = tipo.comodines.map(nombreComodin);
  const invalidos = [...t.matchAll(/\{([^}]*)\}/g)]
    .map((m) => m[1])
    .filter((c) => !permitidos.includes(c));
  if (invalidos.length) {
    return permitidos.length
      ? `Comodín no permitido: {${invalidos[0]}}. Usa ${permitidos.map((c) => `{${c}}`).join(', ')}`
      : `Este mensaje no admite comodines: {${invalidos[0]}}`;
  }
  return null;
}

export const esquemaVersionMensaje = z.object({
  id: z.number().int(),
  clave: z.string(),
  texto: z.string(),
  activo: z.boolean(),
  orden: z.number().int(),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

export const esquemaTipoMensaje = z.object({
  clave: z.string(),
  categoria: z.string(),
  titulo: z.string(),
  descripcion: z.string().nullable(),
  comodines: z.array(z.string()),
  varias: z.boolean(),
  orden: z.number().int(),
  versiones: z.array(esquemaVersionMensaje),
});

const texto = z.string().trim().min(1, 'Requerido').max(4000);
// `confirmar`: la persona aceptó dejar sin versiones activas un mensaje protegido.
const confirmar = z.boolean().default(false);

export const esquemaCrearMensaje = z.object({
  clave: z.string().min(1),
  texto,
  activo: z.boolean(),
});
export const esquemaEditarMensaje = z.object({ texto, activo: z.boolean(), version, confirmar });
export const esquemaActivoMensaje = z.object({ activo: z.boolean(), version, confirmar });
export const esquemaEliminarMensaje = z.object({
  version,
  confirmar: z.preprocess((v) => v === 'true' || v === true, z.boolean()),
});
export const esquemaReordenarMensajes = z
  .array(z.object({ id: z.number().int().positive(), orden }))
  .min(1)
  .max(100)
  .refine((l) => new Set(l.map((m) => m.id)).size === l.length, 'Hay mensajes repetidos');

// Lo que recibe el bot en eco_contexto()->'mensajes': { clave: [textos activos por orden] }, solo claves con texto.
export function mensajesParaElBot(tipos) {
  return Object.fromEntries(
    tipos
      .map((t) => [
        t.clave,
        t.versiones
          .filter((v) => v.activo)
          .sort((a, b) => a.orden - b.orden || a.id - b.id)
          .map((v) => v.texto),
      ])
      .filter(([, textos]) => textos.length > 0),
  );
}

export const tieneVersionActiva = (tipo) => tipo.versiones.some((v) => v.activo);

// Ejemplos para la vista previa. `contexto`: { minutos, pauta, vigencia }.
export function textoDeEjemplo(texto, contexto) {
  const valores = {
    nombre: 'Ana',
    minutos: contexto.minutos ?? 10,
    pauta: contexto.pauta ?? 'Pauta de ejemplo',
    vigencia: contexto.vigencia ?? ', válida hasta el 30 de noviembre',
  };
  return texto.replace(/\{([^}]*)\}/g, (todo, c) => (c in valores ? String(valores[c]) : todo));
}

// Mensajes con versiones activas por categoría (para el inicio): [{ categoria, activos, total }].
export function resumenMensajes(tipos) {
  return CATEGORIAS_MENSAJE.map((categoria) => {
    const deCategoria = tipos.filter((t) => t.categoria === categoria);
    return {
      categoria,
      activos: deCategoria.filter(tieneVersionActiva).length,
      total: deCategoria.length,
    };
  }).filter((r) => r.total > 0);
}
