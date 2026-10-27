import { useState } from 'react';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { fecha } from '../../lib/formato.js';
import { usePermiso } from '../auth/hooks.js';
import { useProductos } from '../productos/hooks.js';
import { useCambiarInterruptor, useInterruptores } from './hooks.js';

const TITULOS = {
  precios_habilitados: 'Precios',
  promociones_habilitadas: 'Promociones y descuentos',
};

export function InterruptoresPage() {
  const { data: interruptores, isPending, error } = useInterruptores();
  const { data: productos } = useProductos();
  const puedeEditar = usePermiso('configuracion:editar');
  const cambiar = useCambiarInterruptor();
  const [pendiente, setPendiente] = useState(null); // { clave, habilitado }

  if (isPending) return <p className="text-slate-500">Cargando…</p>;
  if (error) return <MensajeError error={error} />;

  const cerrar = () => {
    setPendiente(null);
    cambiar.reset();
  };
  const sinPrecio = productos?.filter((p) => p.activo && p.precioBase === null).length ?? 0;

  return (
    <section className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Interruptores comerciales</h2>
        <p className="text-sm text-slate-600">
          El bot lee estos valores en cada mensaje: un cambio aplica en el siguiente mensaje de cada
          cliente.
        </p>
      </div>

      {interruptores.map((i) => (
        <div
          key={i.clave}
          className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          <Toggle
            activo={i.habilitado}
            etiqueta={TITULOS[i.clave]}
            deshabilitado={!puedeEditar}
            alCambiar={(habilitado) => setPendiente({ clave: i.clave, habilitado })}
          />
          <div className="flex-1">
            <h3 className="font-medium">
              {TITULOS[i.clave]}{' '}
              <span className={i.habilitado ? 'text-emerald-700' : 'text-slate-500'}>
                · {i.habilitado ? 'Encendido' : 'Apagado'}
              </span>
            </h3>
            <p className="text-sm text-slate-600">{i.descripcion}</p>
            <p className="mt-1 text-xs text-slate-500">
              Último cambio: {fecha(i.actualizadoEn)}{' '}
              {i.actualizadoPor && `por ${i.actualizadoPor}`}
            </p>
          </div>
        </div>
      ))}

      <ConfirmarModal
        abierto={Boolean(pendiente)}
        titulo={
          pendiente &&
          `${pendiente.habilitado ? 'Encender' : 'Apagar'} ${TITULOS[pendiente.clave].toLowerCase()}`
        }
        mensaje={pendiente && <MensajeConfirmacion {...pendiente} sinPrecio={sinPrecio} />}
        textoConfirmar={pendiente?.habilitado ? 'Sí, encender' : 'Sí, apagar'}
        peligro={pendiente?.habilitado}
        cargando={cambiar.isPending}
        error={cambiar.error}
        alConfirmar={() => cambiar.mutate(pendiente, { onSuccess: cerrar })}
        alCancelar={cerrar}
      />
    </section>
  );
}

function MensajeConfirmacion({ clave, habilitado, sinPrecio }) {
  if (clave === 'precios_habilitados' && habilitado) {
    return (
      <div className="space-y-2">
        <p>
          <strong>El bot empezará a dar precios a los clientes</strong> en su siguiente mensaje.
        </p>
        <p>Revisa antes que los precios del catálogo estén correctos.</p>
        {sinPrecio > 0 && (
          <p className="text-amber-700">
            {sinPrecio} producto(s) activo(s) no tienen precio base: para esos el bot no dará
            precio.
          </p>
        )}
      </div>
    );
  }
  if (clave === 'precios_habilitados') {
    return <p>El bot dejará de dar precios: cualquier consulta de precio pasará a un asesor.</p>;
  }
  if (habilitado) {
    return (
      <p>
        El bot empezará a mencionar descuentos y pautas vigentes, y el precio que dé incluirá el
        descuento (si los precios están encendidos).
      </p>
    );
  }
  return <p>El bot dejará de mencionar descuentos y pautas; dará el precio base.</p>;
}
