// Contenedor de cada bloque del dashboard: título, subtítulo opcional y acciones (exportar, ver tabla).
export function Tarjeta({ titulo, subtitulo, acciones, className = '', children }) {
  return (
    <section className={`rounded-lg border border-borde bg-panel p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{titulo}</h3>
          {subtitulo && <p className="text-xs text-apagado">{subtitulo}</p>}
        </div>
        {acciones && <div className="flex items-center gap-3">{acciones}</div>}
      </div>
      {children}
    </section>
  );
}
