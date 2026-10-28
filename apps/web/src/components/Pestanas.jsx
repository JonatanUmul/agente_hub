// Barra de pestañas (mismo estilo que la de "¿Qué ve el bot ahora?").
// `pestanas`: [{ id, titulo, conError }]. Una pestaña con errores se marca para que no pasen desapercibidos.
export function Pestanas({ pestanas, activa, alCambiar }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-panel-2 p-1">
      {pestanas.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={p.id === activa}
          onClick={() => alCambiar(p.id)}
          className={`rounded-md px-3 py-1 text-sm ${p.id === activa ? 'bg-panel font-medium shadow-sm' : 'text-tenue'}`}
        >
          {p.titulo}
          {p.conError && (
            <span className="ml-1 text-peligro" aria-label="con errores">
              •
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
