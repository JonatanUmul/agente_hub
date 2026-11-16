// Mismo estilo que EstadoVigencia: «Solo anuncio» (exclusiva del anuncio) o «Abierta» (para cualquiera).
export function EtiquetaAlcance({ soloPorAnuncio }) {
  const estilo = soloPorAnuncio
    ? 'border-info/30 bg-info/10 text-info'
    : 'border-acento/30 bg-acento/10 text-acento';
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap ${estilo}`}
    >
      {soloPorAnuncio ? 'Solo anuncio' : 'Abierta'}
    </span>
  );
}
