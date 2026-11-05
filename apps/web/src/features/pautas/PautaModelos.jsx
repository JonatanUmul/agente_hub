import { useController } from 'react-hook-form';
import { otrasPautasConDescuento } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { monto, porcentaje } from '../../lib/formato.js';

const GRUPOS = [
  ['equipo', 'Equipos'],
  ['repuesto', 'Repuestos'],
  ['accesorio', 'Accesorios'],
];

function Producto({ producto, marcado, alternar, pautaId }) {
  const otras = marcado ? otrasPautasConDescuento(producto, pautaId) : [];
  return (
    <li>
      <label className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-panel-2">
        <input type="checkbox" checked={marcado} onChange={() => alternar(producto.id)} />
        <span className="flex-1">
          {producto.nombre}{' '}
          <span className="font-mono text-[11px] text-apagado">{producto.codigo}</span>
          {producto.estado !== 'disponible' && (
            <span className="ml-2 text-xs text-alerta">{producto.estado}</span>
          )}
        </span>
        <span className="text-xs text-tenue tabular-nums">{monto(producto.precioBase)}</span>
      </label>
      {otras.map((pa) => (
        <p key={pa.id} className="pl-7 text-xs text-alerta">
          También está en «{pa.nombre}» ({porcentaje(pa.descuentoPct)}). El bot usa el descuento
          mayor.
        </p>
      ))}
    </li>
  );
}

// Sección «Modelos» del formulario de pauta: campos `aplicaTodos` y `productoIds`.
// Los productos inactivos ya asociados no se muestran, pero se conservan en la selección.
export function PautaModelos({ control, productos, pautaId }) {
  const todos = useController({ control, name: 'aplicaTodos' }).field;
  const { field, fieldState } = useController({ control, name: 'productoIds' });
  const activos = productos.filter((p) => p.activo);
  const idsActivos = new Set(activos.map((p) => p.id));
  const ocultos = field.value.filter((id) => !idsActivos.has(id));
  const fijar = (ids) => field.onChange([...new Set([...ocultos, ...ids])].sort((a, b) => a - b));
  const marcados = field.value.filter((id) => idsActivos.has(id));
  const alternar = (id) =>
    fijar(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id]);
  const equipos = activos.filter((p) => p.tipo === 'equipo').map((p) => p.id);

  return (
    <section className="space-y-3 border-t border-borde pt-4">
      <h3 className="font-medium">Modelos</h3>
      <div className="flex items-start gap-3 text-sm">
        <Toggle
          activo={todos.value}
          etiqueta="Aplica a todos los modelos"
          alCambiar={todos.onChange}
        />
        <div>
          <p>Aplica a todos los modelos</p>
          <p className="text-xs text-tenue">
            Para formas de pago o beneficios generales, como Visa Cuotas. El bot mostrará todos los
            equipos disponibles, incluso los que se agreguen después.
          </p>
        </div>
      </div>

      {!todos.value && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-tenue">{marcados.length} seleccionado(s)</p>
            <div className="flex gap-3">
              <Boton
                variante="enlace"
                onClick={() => fijar([...new Set([...marcados, ...equipos])])}
              >
                Todos los equipos
              </Boton>
              <Boton variante="enlace" onClick={() => fijar([])}>
                Ninguno
              </Boton>
            </div>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-borde-fuerte bg-fondo p-2">
            {GRUPOS.map(([tipo, titulo]) => {
              const delGrupo = activos.filter((p) => p.tipo === tipo);
              if (!delGrupo.length) return null;
              return (
                <div key={tipo}>
                  <p className="px-1.5 text-xs font-medium text-tenue">{titulo}</p>
                  <ul>
                    {delGrupo.map((p) => (
                      <Producto
                        key={p.id}
                        producto={p}
                        marcado={marcados.includes(p.id)}
                        alternar={alternar}
                        pautaId={pautaId}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {ocultos.length > 0 && (
            <p className="text-xs text-apagado">
              Además, {ocultos.length} producto(s) inactivo(s) siguen asociados.
            </p>
          )}
        </>
      )}
      {fieldState.error && <p className="text-xs text-peligro">{fieldState.error.message}</p>}
    </section>
  );
}
