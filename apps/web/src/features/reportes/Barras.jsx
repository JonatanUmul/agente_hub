import { entero } from './formato.js';

// Barras horizontales simples (una sola serie, un solo color) con el valor al final de cada barra.
// `filas`: [{ clave, etiqueta, valor, detalle? }]
export function Barras({ filas, vacio = 'Sin datos en el periodo' }) {
  const maximo = Math.max(0, ...filas.map((f) => f.valor));
  if (filas.length === 0) return <p className="text-sm text-apagado">{vacio}</p>;
  return (
    <ul className="space-y-2">
      {filas.map((f) => (
        <li key={f.clave} title={`${f.etiqueta}: ${entero(f.valor)}`}>
          <div className="mb-0.5 flex justify-between gap-2 text-xs">
            <span className="truncate">{f.etiqueta}</span>
            {f.detalle && <span className="shrink-0 text-apagado">{f.detalle}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 flex-1">
              <div
                className="h-full rounded-r-[4px] bg-serie-1"
                style={{ width: `${maximo ? Math.max(1, (f.valor / maximo) * 100) : 0}%` }}
              />
            </div>
            <span className="w-12 text-right text-xs tabular-nums">{entero(f.valor)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
