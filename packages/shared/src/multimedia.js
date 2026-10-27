import { z } from 'zod';
import { fechaIso, orden, textoOpcional, textoRequerido, version } from './comunes.js';

export const TIPOS_MULTIMEDIA = ['imagen', 'video', 'promocion'];

export const esquemaArchivo = z.object({
  id: z.number().int(),
  tipo: z.enum(TIPOS_MULTIMEDIA),
  hubspotFileId: z.string(),
  descripcion: z.string(),
  producto: z.object({ id: z.number().int(), codigo: z.string(), nombre: z.string() }).nullable(),
  color: z.string().nullable(),
  tema: z.string().nullable(),
  // Pautas en cuyas imágenes aparece el archivo (puede haber varias).
  pautas: z.array(z.object({ id: z.number().int(), codigo: z.string(), nombre: z.string() })),
  orden: z.number().int(),
  activo: z.boolean(),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

const camposEditables = {
  descripcion: textoRequerido(500),
  productoId: z.number().int().positive().nullable(),
  color: textoOpcional(100),
  tema: textoOpcional(100),
  // Sin repetidos y ordenadas, para comparar sin importar el orden en que se marcaron.
  pautaIds: z
    .array(z.number().int().positive())
    .max(50)
    .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
  orden,
  activo: z.boolean(),
};

// tipo + ID de archivo identifican el archivo (UNIQUE en la base): se fijan al crear.
export const esquemaCrearArchivo = z.object({
  tipo: z.enum(TIPOS_MULTIMEDIA),
  hubspotFileId: textoRequerido(200),
  ...camposEditables,
});

export const esquemaEditarArchivo = z.object({ ...camposEditables, version });

// Cómo llega cada archivo al bot, según eco_contexto():
// - imagen / video activos → lista general de multimedia;
// - cualquier tipo activo con pautas → imágenes de cada una (solo si la pauta está vigente y hay promociones);
// - promocion sin pautas → el bot nunca lo ve.
export function comoLoVeElBot({ tipo, activo, pautaIds = [] }) {
  if (!activo) return { visible: false, detalle: 'Inactivo: el bot no lo ve' };
  const enLista = tipo === 'imagen' || tipo === 'video';
  const enPauta = pautaIds.length > 0;
  if (!enLista && !enPauta) {
    return {
      visible: false,
      detalle: 'Una promoción sin pauta no llega al bot: asóciala a una pauta',
    };
  }
  const enPautas =
    pautaIds.length === 1 ? 'imágenes de su pauta' : `imágenes de sus ${pautaIds.length} pautas`;
  const lugares = [enLista && 'lista de multimedia', enPauta && enPautas].filter(Boolean);
  return { visible: true, detalle: `Aparece en: ${lugares.join(' y ')}` };
}
