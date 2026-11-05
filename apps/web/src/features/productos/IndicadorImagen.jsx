import { faltantesVision } from '@ecofiltro/shared';

const TEXTOS = { pistas: 'pistas visuales', fotos: 'fotos de referencia' };

// ✓ si el identificador de imágenes tiene pistas y al menos una foto; ⚠ si le falta algo.
export function IndicadorImagen({ producto }) {
  const faltan = faltantesVision(producto);
  if (faltan === null) return <span className="text-apagado">—</span>;
  if (faltan.length === 0)
    return (
      <span className="text-acento" title="Tiene pistas y fotos de referencia">
        ✓
      </span>
    );
  const texto = `Falta: ${faltan.map((f) => TEXTOS[f]).join(', ')}`;
  return (
    <span className="text-alerta" title={texto} aria-label={texto}>
      ⚠
    </span>
  );
}
