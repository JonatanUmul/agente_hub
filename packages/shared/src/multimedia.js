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
  pauta: z.object({ id: z.number().int(), codigo: z.string(), nombre: z.string() }).nullable(),
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
  pautaId: z.number().int().positive().nullable(),
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
// - cualquier tipo activo con pauta → imágenes de esa pauta (solo si la pauta está vigente y hay promociones);
// - promocion sin pauta → el bot nunca lo ve.
export function comoLoVeElBot({ tipo, activo, pautaId }) {
  if (!activo) return { visible: false, detalle: 'Inactivo: el bot no lo ve' };
  const enLista = tipo === 'imagen' || tipo === 'video';
  const enPauta = pautaId !== null && pautaId !== undefined;
  if (!enLista && !enPauta) {
    return {
      visible: false,
      detalle: 'Una promoción sin pauta no llega al bot: asóciala a una pauta',
    };
  }
  const lugares = [enLista && 'lista de multimedia', enPauta && 'imágenes de su pauta'].filter(
    Boolean,
  );
  return { visible: true, detalle: `Aparece en: ${lugares.join(' y ')}` };
}
