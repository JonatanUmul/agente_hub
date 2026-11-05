import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BLOQUES_TIEMPOS,
  INTERRUPTORES_TIEMPOS,
  INTERRUPTOR_RECUPERACION,
  INTERRUPTOR_SEGUIMIENTO_IA,
  PARAMETROS_ENTEROS,
  textosTiempo,
} from '@ecofiltro/shared';
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

// Interruptor de inactividad con confirmación. `nota`: aviso que se muestra a la derecha.
function InterruptorTiempo({ clave, interruptores, puedeEditar, nota }) {
  const cambiar = useCambiarInterruptor();
  const [pendiente, setPendiente] = useState(null);
  const { titulo, descripcion } = INTERRUPTORES_TIEMPOS[clave];
  const interruptor = interruptores.find((i) => i.clave === clave);
  if (!interruptor) return <p className="text-sm text-alerta">No existe la clave {clave}.</p>;
  const cerrar = () => {
    setPendiente(null);
    cambiar.reset();
  };
  return (
    <div className="flex items-start gap-3 text-sm">
      <Toggle
        activo={interruptor.habilitado}
        etiqueta={titulo}
        deshabilitado={!puedeEditar}
        alCambiar={(habilitado) => setPendiente(habilitado)}
      />
      <div>
        <p>
          {titulo}
          {nota && <span className="ml-2 text-xs text-alerta">{nota}</span>}
        </p>
        {descripcion && <p className="text-xs text-tenue">{descripcion}</p>}
      </div>
      <ConfirmarModal
        abierto={pendiente !== null}
        titulo={`${pendiente ? 'Encender' : 'Apagar'} ${titulo.toLowerCase()}`}
        mensaje="El cambio aplica en el siguiente mensaje de cada cliente."
        textoConfirmar={pendiente ? 'Encender' : 'Apagar'}
        cargando={cambiar.isPending}
        error={cambiar.error}
        alConfirmar={() => cambiar.mutate({ clave, habilitado: pendiente }, { onSuccess: cerrar })}
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

// Con el seguimiento con IA: un seguimiento según el caso y el cierre sin mensaje.
function LineaSeguimientoIa({ valores }) {
  const aviso = valores.minutos_aviso_inactividad;
  const cierre = valores.minutos_cierre_inactividad;
  const despues = Number.isInteger(aviso) && Number.isInteger(cierre) ? cierre - aviso : '—';
  return (
    <ol className="space-y-2 rounded-md bg-panel-2 p-3 text-sm">
      <Paso cuando={`${aviso ?? '—'} min sin respuesta`}>
        la IA envía un seguimiento (modelos, producto, promoción o atención al cliente) o cierra sin
        mensaje
      </Paso>
      <Paso cuando={`+${despues} min sin respuesta`}>
        se cierra sin mensaje; el analizador decide si pasa a un asesor
      </Paso>
    </ol>
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
  const { data: interruptores = [] } = useInterruptores();
  const puedeEditar = usePermiso('configuracion:editar');
  if (isPending) return <p className="text-tenue">Cargando…</p>;
  if (error) return <MensajeError error={error} />;

  const seguimientoIa = Boolean(
    interruptores.find((i) => i.clave === INTERRUPTOR_SEGUIMIENTO_IA)?.habilitado,
  );

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
            {bloque === 'Inactividad y seguimiento' && (
              <div className="space-y-3">
                <InterruptorTiempo
                  clave={INTERRUPTOR_SEGUIMIENTO_IA}
                  interruptores={interruptores}
                  puedeEditar={puedeEditar}
                />
                <InterruptorTiempo
                  clave={INTERRUPTOR_RECUPERACION}
                  interruptores={interruptores}
                  puedeEditar={puedeEditar}
                  nota={seguimientoIa && 'No se usa mientras el seguimiento con IA está encendido'}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {claves.map((c) =>
                porClave[c] ? (
                  <CampoTiempo
                    key={c}
                    parametro={porClave[c]}
                    textos={textosTiempo(c, seguimientoIa)}
                    puedeEditar={puedeEditar}
                  />
                ) : (
                  <p key={c} className="text-sm text-alerta">
                    No existe la clave {c}.
                  </p>
                ),
              )}
            </div>
            {bloque === 'Inactividad y seguimiento' &&
              (seguimientoIa ? (
                <LineaSeguimientoIa valores={valores} />
              ) : (
                <LineaInactividad valores={valores} />
              ))}
          </div>
        );
      })}
    </section>
  );
}
