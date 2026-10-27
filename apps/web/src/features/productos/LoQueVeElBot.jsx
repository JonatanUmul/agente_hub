import { precioQueVeElBot } from '@ecofiltro/shared';
import { monto } from '../../lib/formato.js';

// Resume en una línea qué precio dará el bot por este producto con los interruptores actuales.
export function LoQueVeElBot({ producto, interruptores }) {
  const resultado = precioQueVeElBot({
    producto,
    preciosHabilitados: interruptores.precios_habilitados,
    promocionesHabilitadas: interruptores.promociones_habilitadas,
  });
  if (!resultado.visible) return <span className="text-tenue">{resultado.motivo}</span>;
  return (
    <span className="font-medium">
      {monto(resultado.precio)}
      {resultado.descuentoPct && <span className="text-acento"> (−{resultado.descuentoPct}%)</span>}
    </span>
  );
}
