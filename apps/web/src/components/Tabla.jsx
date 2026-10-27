// Tabla simple. `columnas`: [{ titulo, celda: (fila) => contenido, className? }]
export function Tabla({ columnas, filas, clave = (fila) => fila.id, vacio = 'No hay registros' }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-borde bg-panel">
      <table className="min-w-full text-sm">
        <thead className="border-b border-borde bg-panel-2/60 text-left">
          <tr>
            {columnas.map((c) => (
              <th
                key={c.titulo}
                className={`px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-apagado ${c.className ?? ''}`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {filas.length === 0 && (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-10 text-center text-tenue">
                {vacio}
              </td>
            </tr>
          )}
          {filas.map((fila) => (
            <tr key={clave(fila)} className="transition-colors hover:bg-panel-2/50">
              {columnas.map((c) => (
                <td key={c.titulo} className={`px-4 py-2.5 align-middle ${c.className ?? ''}`}>
                  {c.celda(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
