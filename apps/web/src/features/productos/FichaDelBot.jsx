import { fichaQueVeElBot } from '@ecofiltro/shared';

// Ficha que recibe el bot cuando el cliente pregunta por el detalle del producto.
// Solo aparecen los campos con valor (los vacíos no se le envían).
export function FichaDelBot({ producto }) {
  if (!producto.activo)
    return <p className="text-tenue">Producto inactivo: el bot no lo conoce.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {fichaQueVeElBot(producto).map(({ etiqueta, valor }) => (
        <div key={etiqueta} className="contents">
          <dt className="text-tenue">{etiqueta}</dt>
          <dd>
            {Array.isArray(valor) && etiqueta === 'Características' ? (
              <ul className="list-disc pl-4">
                {valor.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            ) : Array.isArray(valor) ? (
              valor.join(', ')
            ) : (
              valor
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
