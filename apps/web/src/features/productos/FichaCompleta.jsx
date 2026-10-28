import { faltantesFicha } from '@ecofiltro/shared';

// Indicador de la tabla: qué le falta a la ficha de un equipo para que el bot responda el detalle
// sin inventar. A accesorios y repuestos no se les exige ficha completa.
export function FichaCompleta({ producto }) {
  const faltan = faltantesFicha(producto);
  if (faltan === null) return <span className="text-apagado">No aplica</span>;
  if (faltan.length === 0) return <span className="text-acento">✓ Completa</span>;
  return (
    <span className="text-alerta" title={`Falta: ${faltan.join(', ')}`}>
      Falta: {faltan.join(', ')}
    </span>
  );
}
