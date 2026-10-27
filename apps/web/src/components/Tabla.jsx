// Tabla simple. `columnas`: [{ titulo, celda: (fila) => contenido, className? }]
export function Tabla({ columnas, filas, clave = (fila) => fila.id, vacio = 'No hay registros' }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} className={`px-4 py-2 font-medium ${c.className ?? ''}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.length === 0 && (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-6 text-center text-slate-500">
                {vacio}
              </td>
            </tr>
          )}
          {filas.map((fila) => (
            <tr key={clave(fila)}>
              {columnas.map((c) => (
                <td key={c.titulo} className={`px-4 py-2 ${c.className ?? ''}`}>
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
