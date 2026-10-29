import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BLOQUES_TIEMPOS, INTERRUPTOR_RECUPERACION, PARAMETROS_ENTEROS } from '@ecofiltro/shared';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { usePermiso } from '../auth/hooks.js';
import { CampoTiempo } from './CampoTiempo.jsx';
import { useCambiarInterruptor, useInterruptores, useParametros } from './hooks.js';

const enlaceMensaje = (clave, texto) => (
  <Link to={`/mensajes#${clave}`} className="text-acento hover:underline">
    {texto}
  </Link>
);

function Recuperacion({ puedeEditar }) {
  const { data } = useInterruptores();
  const cambiar = useCambiarInterruptor();
  const [pendiente, setPendiente] = useState(null);
  const interruptor = data?.find((i) => i.clave === INTERRUPTOR_RECUPERACION);
  if (!data) return null;
  if (!interruptor)
    return <p className="text-sm text-alerta">No existe la clave {INTERRUPTOR_RECUPERACION}.</p>;
  const cerrar = () => {
    setPendiente(null);
    cambiar.reset();
  };
  return (
    <div className="flex items-center gap-3 text-sm">
      <Toggle
        activo={interruptor.habilitado}
        etiqueta="Seguimiento a clientes interesados"
        deshabilitado={!puedeEditar}
        alCambiar={(habilitado) => setPendiente(habilitado)}
      />
      Seguimiento a clientes interesados
      <ConfirmarModal
        abierto={pendiente !== null}
        titulo={pendiente ? 'Encender seguimiento' : 'Apagar seguimiento'}
        mensaje={
          pendiente
            ? 'El bot volverá a escribir a los clientes interesados que dejen de responder.'
            : 'El bot dejará de escribir a los clientes interesados que dejen de responder.'
        }
        textoConfirmar={pendiente ? 'Encender' : 'Apagar'}
        cargando={cambiar.isPending}
        error={cambiar.error}
        alConfirmar={() =>
          cambiar.mutate(
            { clave: INTERRUPTOR_RECUPERACION, habilitado: pendiente },
            { onSuccess: cerrar },
          )
        }
        alCancelar={cerrar}
      />
    </div>
  );
}

function Paso({ cuando, children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-serie-1" />
      <span>
        <strong className="tabular-nums">{cuando}</strong> · {children}
      </span>
    </li>
  );
}

// Los dos caminos cuando el cliente deja de responder, con los valores actuales.
function LineaInactividad({ valores }) {
  const v = (clave) => valores[clave] ?? '—';
  return (
    <div className="grid gap-4 rounded-md bg-panel-2 p-3 text-sm md:grid-cols-2">
      <div>
        <p className="mb-2 font-medium">Cliente interesado</p>
        <ol className="space-y-2">
          <Paso cuando={`${v('minutos_aviso_inactividad')} min`}>
            {enlaceMensaje('seguimiento_compra', 'seguimiento')}
          </Paso>
          <Paso cuando={`+${v('minutos_asesor_recuperacion')} min`}>
            {enlaceMensaje('seguimiento_asesor', 'ofrece asesor')}
          </Paso>
          <Paso cuando={`+${v('minutos_espera_nombre')} min`}>
            pasa a Televentas si no responde
          </Paso>
        </ol>
      </div>
      <div>
        <p className="mb-2 font-medium">Conversación normal</p>
        <ol className="space-y-2">
          <Paso cuando={`${v('minutos_aviso_inactividad')} min`}>
            {enlaceMensaje('inactividad_aviso', 'aviso')}
          </Paso>
          <Paso cuando={`${v('minutos_cierre_inactividad')} min`}>
            {enlaceMensaje('inactividad_cierre', 'cierre')}
          </Paso>
        </ol>
      </div>
    </div>
  );
}

export function TiemposPage() {
  const { data: parametros, isPending, error } = useParametros();
  const puedeEditar = usePermiso('configuracion:editar');
  if (isPending) return <p className="text-tenue">Cargando…</p>;
  if (error) return <MensajeError error={error} />;

  const porClave = Object.fromEntries(parametros.map((p) => [p.clave, p]));
  const valores = Object.fromEntries(parametros.map((p) => [p.clave, p.valor]));

  return (
    <section className="max-w-4xl space-y-4">
      <h2 className="text-lg font-semibold">Tiempos</h2>
      {BLOQUES_TIEMPOS.map((bloque) => {
        const claves = Object.keys(PARAMETROS_ENTEROS).filter(
          (c) => PARAMETROS_ENTEROS[c].bloque === bloque,
        );
        return (
          <div key={bloque} className="space-y-4 rounded-lg border border-borde bg-panel p-4">
            <h3 className="font-medium">{bloque}</h3>
            {bloque === 'Inactividad y seguimiento' && <Recuperacion puedeEditar={puedeEditar} />}
            <div className="grid gap-4 sm:grid-cols-2">
              {claves.map((c) =>
                porClave[c] ? (
                  <CampoTiempo key={c} parametro={porClave[c]} puedeEditar={puedeEditar} />
                ) : (
                  <p key={c} className="text-sm text-alerta">
                    No existe la clave {c}.
                  </p>
                ),
              )}
            </div>
            {bloque === 'Inactividad y seguimiento' && <LineaInactividad valores={valores} />}
          </div>
        );
      })}
    </section>
  );
}
