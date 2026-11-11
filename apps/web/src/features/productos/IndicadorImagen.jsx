import { faltantesVision } from '@ecofiltro/shared';

const TEXTOS = { pistas: 'pistas visuales', fotos: 'fotos de referencia' };

// Identificación por imagen: ✓ si tiene pistas y al menos una foto; ⚠ con lo que falta. Nada si no aplica.
export function IndicadorImagen({ producto }) {
  const faltan = faltantesVision(producto);
  if (faltan === null) return null;
  if (faltan.length === 0) return <p className="text-acento">✓ Imagen</p>;
  return <p className="text-alerta">⚠ Imagen: falta {faltan.map((f) => TEXTOS[f]).join(', ')}</p>;
}
