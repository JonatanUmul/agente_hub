import { avisosProducto, faltantesFicha } from '@ecofiltro/shared';

// Lo que le falta a la ficha de un equipo (a accesorios y repuestos no se les exige) y los avisos de
// datos que se contradicen. Ninguno impide guardar.
const faltan = (p) => faltantesFicha(p) ?? [];
export const tieneAvisos = (p) => faltan(p).length > 0 || avisosProducto(p).length > 0;

export function FichaCompleta({ producto }) {
  const falta = faltantesFicha(producto);
  const avisos = avisosProducto(producto);
  return (
    <div className="space-y-0.5">
      {falta === null && avisos.length === 0 && <p className="text-apagado">No aplica</p>}
      {falta?.length === 0 && <p className="text-acento">✓ Completa</p>}
      {falta?.length > 0 && <p className="text-alerta">Falta: {falta.join(', ')}</p>}
      {avisos.map((aviso) => (
        <p key={aviso} className="text-alerta">
          ⚠ {aviso}
        </p>
      ))}
    </div>
  );
}
