import { useController } from 'react-hook-form';
import { porcentaje } from '../lib/formato.js';

// Casillas para elegir varias pautas (campo `pautaIds` del formulario). Controlado con useController
// para que el valor sea siempre una lista de ids, también cuando existe una sola pauta.
export function SelectorPautas({ control, pautas, error, ayuda, mostrarDescuento = false }) {
  const { field } = useController({ control, name: 'pautaIds' });
  const alternar = (id) =>
    field.onChange(
      field.value.includes(id)
        ? field.value.filter((x) => x !== id)
        : [...field.value, id].sort((a, b) => a - b),
    );

  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-tenue">Pautas</legend>
      {pautas.length === 0 ? (
        <p className="text-sm text-apagado">No hay pautas creadas.</p>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-borde-fuerte bg-fondo p-2">
          {pautas.map((pa) => (
            <label
              key={pa.id}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-panel-2"
            >
              <input
                type="checkbox"
                checked={field.value.includes(pa.id)}
                onChange={() => alternar(pa.id)}
              />
              <span className="flex-1">{pa.nombre}</span>
              {mostrarDescuento && (
                <span className="text-xs text-tenue">{porcentaje(pa.descuentoPct)}</span>
              )}
              {!pa.vigente && <span className="text-xs text-apagado">no vigente</span>}
            </label>
          ))}
        </div>
      )}
      {ayuda && <span className="mt-1 block text-xs text-apagado">{ayuda}</span>}
      {error && <span className="mt-1 block text-xs text-peligro">{error.message}</span>}
    </fieldset>
  );
}
