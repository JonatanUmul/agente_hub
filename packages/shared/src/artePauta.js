import { z } from 'zod';
import { textoRequerido, version } from './comunes.js';

// Imagen propia de una pauta («arte»): una imagen de eco_multimedia con pauta_id = la pauta y sin producto.
// Con arte, el bot envía solo los artes activos (hasta 3); sin arte, hasta max_fotos_pauta fotos de producto.
// n8n lee la columna eco_multimedia.pauta_id (no la tabla de varias pautas) y respeta `orden`.
export const MAX_ARTES_PAUTA = 3;

const esImagen = (a) => a.tipo !== 'video';
const dePauta = (a, pautaId) => a.pautaIdPrincipal === pautaId;
const porOrden = (a, b) => a.orden - b.orden || a.id - b.id;

export const esArte = (a) => a.producto === null;

// Imágenes de la pauta como las ve el bot (activas o no), ordenadas.
export const imagenesDePauta = (archivos, pautaId) =>
  archivos.filter((a) => esImagen(a) && dePauta(a, pautaId)).sort(porOrden);

// Archivos asociados a la pauta que el bot no usa para ella: su pauta principal es otra.
export const imagenesNoUsadas = (archivos, pautaId) =>
  archivos.filter(
    (a) =>
      esImagen(a) && !dePauta(a, pautaId) && a.pautas.some((p) => p.id === pautaId) && a.activo,
  );

// Lo que recibe el cliente que llega por la pauta: { conArte, imagenes, artesActivos }.
export function loQueRecibeElCliente(archivos, pautaId, maxFotos) {
  const activas = imagenesDePauta(archivos, pautaId).filter((a) => a.activo);
  const artes = activas.filter(esArte);
  if (artes.length) {
    return {
      conArte: true,
      imagenes: artes.slice(0, MAX_ARTES_PAUTA),
      artesActivos: artes.length,
    };
  }
  return {
    conArte: false,
    imagenes: activas.filter((a) => !esArte(a)).slice(0, Math.max(0, maxFotos)),
    artesActivos: 0,
  };
}

// Alta del arte. `reemplaza`: arte anterior que se desactiva en la misma operación.
export const esquemaCrearArte = z.object({
  pautaId: z.number().int().positive(),
  hubspotFileId: textoRequerido(200),
  descripcion: textoRequerido(500),
  reemplaza: z.object({ id: z.number().int().positive(), version }).nullable().default(null),
});
