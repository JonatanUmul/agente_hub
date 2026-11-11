const TABLAS = {
  eco_reglas_bot: 'Regla',
  eco_preguntas_frecuentes: 'Pregunta frecuente',
  eco_mensajes: 'Mensaje del bot',
  eco_productos: 'Compatible con, en el producto',
};

// Paso de confirmación al cambiar el ItemCode: qué cuelga del producto y qué textos escriben el código viejo.
// `entendido` / `alEntender`: con menciones, la persona debe marcar que las corregirá a mano.
export function ImpactoCodigo({ antes, despues, impacto, entendido, alEntender }) {
  const { dependencias: d, menciones } = impacto;
  return (
    <div className="space-y-2 rounded-md border border-alerta/30 bg-alerta/10 p-3 text-sm">
      <p>
        ItemCode <span className="font-mono">{antes}</span> →{' '}
        <span className="font-mono font-medium">{despues}</span>
      </p>
      <p className="text-tenue">
        Siguen ligados al producto: {d.multimedia} archivo(s) de multimedia, {d.productosPautas}{' '}
        pauta(s) y {d.multimediaPautas} enlace(s) de archivos con pautas.
      </p>
      {menciones.length > 0 && (
        <>
          <p className="font-medium text-alerta">
            Estos textos escriben {antes} y quedarán desactualizados:
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {menciones.map((m) => (
              <li key={`${m.tabla}-${m.id}`}>
                {TABLAS[m.tabla] ?? m.tabla}: {m.etiqueta}
                {!m.activo && <span className="text-tenue"> (inactivo)</span>}
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={entendido}
              onChange={(e) => alEntender(e.target.checked)}
            />
            Los corregiré a mano
          </label>
        </>
      )}
    </div>
  );
}
