import { z } from 'zod';
import { textoPlanoOpcional } from './comunes.js';

// Identificación de modelos por imagen (flujo Analizar_imagen de n8n): compara la foto del cliente con las
// fotos de referencia y las pistas visuales de cada producto (eco_productos.pistas_visuales y
// fotos_referencia). Los agotados y descontinuados también sirven: los clientes tienen equipos viejos.

export const MAX_FOTOS_REFERENCIA = 6;
export const MAX_PISTAS_VISUALES = 600;
export const TIPOS_CON_VISION = ['equipo', 'repuesto'];
export const INTERRUPTOR_VISION = 'vision_activa';
export const CAMPOS_VISION = ['pistasVisuales', 'fotosReferencia'];

// El identificador descarga la foto: debe ser una URL pública con https.
export function esUrlPublica(texto) {
  if (typeof texto !== 'string' || !texto.startsWith('https://')) return false;
  try {
    return Boolean(new URL(texto).hostname);
  } catch {
    return false;
  }
}

export const esquemaFotoReferencia = z.object({
  url: z
    .string()
    .trim()
    .max(1000, 'Máximo 1000 caracteres')
    .refine(esUrlPublica, 'Debe ser una URL que empiece con https://'),
  color: textoPlanoOpcional(100),
});

export const camposVision = {
  pistasVisuales: textoPlanoOpcional(MAX_PISTAS_VISUALES),
  fotosReferencia: z
    .array(esquemaFotoReferencia)
    .max(MAX_FOTOS_REFERENCIA, `Máximo ${MAX_FOTOS_REFERENCIA} fotos`)
    .refine(
      (fotos) => new Set(fotos.map((f) => f.url)).size === fotos.length,
      'Hay fotos repetidas',
    ),
};

// Qué le falta para que el identificador lo reconozca bien; null si no aplica (inactivo o accesorio).
export function faltantesVision(p) {
  if (!p.activo || !TIPOS_CON_VISION.includes(p.tipo)) return null;
  const faltan = [];
  if (!p.pistasVisuales?.trim()) faltan.push('pistas');
  if (!p.fotosReferencia?.length) faltan.push('fotos');
  return faltan;
}

// Multimedia guarda el ID de archivo de HubSpot; solo sirve de referencia si ese valor ya es una URL pública.
export const urlPublicaDeArchivo = (archivo) =>
  esUrlPublica(archivo.hubspotFileId) ? archivo.hubspotFileId : null;
