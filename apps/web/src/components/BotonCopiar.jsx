import { useState } from 'react';

// Copia un texto al portapapeles (p. ej. el ItemCode para pegarlo en una orden de venta).
export function BotonCopiar({ texto, etiqueta = 'Copiar' }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin permiso de portapapeles (navegador antiguo o http fuera de localhost): no hacemos nada.
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      title={`${etiqueta} ${texto}`}
      className="rounded px-1 text-xs text-acento hover:bg-acento/10"
    >
      {copiado ? '¡Copiado!' : etiqueta}
    </button>
  );
}
