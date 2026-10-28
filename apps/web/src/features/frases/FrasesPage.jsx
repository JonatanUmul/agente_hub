import { useState } from 'react';
import {
  FRASES_RECOMENDADAS,
  INFO_SITUACIONES,
  SITUACIONES_FRASE,
  botsSinFrasesGenerales,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Pestanas } from '../../components/Pestanas.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { usePermiso } from '../auth/hooks.js';
import { useInterruptores } from '../configuracion/hooks.js';
import { FraseForm } from './FraseForm.jsx';
import { GrupoFrases } from './GrupoFrases.jsx';
import {
  useCambiarActivoFrase,
  useCambiarCierreAutomatico,
  useCrearFrase,
  useEditarFrase,
  useEliminarFrase,
  useFrases,
  useReordenarFrases,
} from './hooks.js';

// Pestañas por módulo. "Compras" y "Atención" muestran lo que recibe ese bot: sus frases + las GLOBAL.
const PESTANAS = [
  { id: 'todas', titulo: 'Todas', modulos: null },
  { id: 'GLOBAL', titulo: 'General (GLOBAL)', modulos: ['GLOBAL'] },
  { id: 'COMPRA', titulo: 'Compras', modulos: ['GLOBAL', 'COMPRA'] },
  { id: 'SAC', titulo: 'Atención al cliente', modulos: ['GLOBAL', 'SAC'] },
  { id: 'DISTRIBUIDOR', titulo: 'Distribuidores', modulos: ['GLOBAL', 'DISTRIBUIDOR'] },
];

export function FrasesPage() {
  const { data: frases, isPending, error } = useFrases();
  const puedeEditar = usePermiso('frases:editar');
  const [pestana, setPestana] = useState('todas');
  const [accion, setAccion] = useState(null); // { tipo: 'crear' | 'editar' | 'activo' | 'eliminar', frase?, inicial? }
  const crear = useCrearFrase();
  const editar = useEditarFrase();
  const cambiarActivo = useCambiarActivoFrase();
  const eliminar = useEliminarFrase();
  const reordenar = useReordenarFrases();

  if (isPending) return <p className="text-tenue">Cargando frases…</p>;
  if (error) return <MensajeError error={error} />;

  const cerrar = () => {
    setAccion(null);
    [crear, editar, cambiarActivo, eliminar].forEach((m) => m.reset());
  };
  const { modulos } = PESTANAS.find((p) => p.id === pestana);
  const visibles = frases.filter((f) => !modulos || modulos.includes(f.modulo));
  const moduloNuevo = pestana === 'todas' ? 'GLOBAL' : pestana;
  const frase = accion?.frase;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Frases de cierre</h2>
          <p className="text-sm text-tenue">
            Las preguntas con que el bot termina sus mensajes. Un cambio aplica en el siguiente
            mensaje, sin tocar n8n.
          </p>
        </div>
        {puedeEditar && (
          <Boton onClick={() => setAccion({ tipo: 'crear', inicial: { modulo: moduloNuevo } })}>
            Agregar frase
          </Boton>
        )}
      </div>

      <CierreAutomatico puedeEditar={puedeEditar} />
      {botsSinFrasesGenerales(frases).map(({ modulo, bot }) => (
        <p
          key={modulo}
          role="alert"
          className="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm"
        >
          ⚠ El bot de {bot} no tiene frases de cierre generales activas (ni propias ni GLOBAL).
        </p>
      ))}
      <Ayuda />

      <Pestanas pestanas={PESTANAS} activa={pestana} alCambiar={setPestana} />
      <MensajeError error={reordenar.error} />

      {SITUACIONES_FRASE.map((situacion) => {
        const delGrupo = visibles.filter((f) => f.situacion === situacion);
        const activas = delGrupo.filter((f) => f.activo).length;
        return (
          <div key={situacion} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">
                {INFO_SITUACIONES[situacion].titulo}{' '}
                <span className="text-sm font-normal text-tenue">
                  · {activas} activa(s) · {INFO_SITUACIONES[situacion].cuando}
                </span>
              </h3>
              {puedeEditar && (
                <Boton
                  variante="enlace"
                  onClick={() =>
                    setAccion({ tipo: 'crear', inicial: { modulo: moduloNuevo, situacion } })
                  }
                >
                  Agregar aquí
                </Boton>
              )}
            </div>
            {situacion !== 'general' && activas === 0 && (
              <p className="text-xs text-apagado">
                Sin frases activas: en esta situación el bot usa las de General.
              </p>
            )}
            <GrupoFrases
              frases={delGrupo}
              puedeEditar={puedeEditar}
              alReordenar={(lista) => reordenar.mutate(lista)}
              alCambiarActivo={(f, activo) => setAccion({ tipo: 'activo', frase: f, activo })}
              alEditar={(f) => setAccion({ tipo: 'editar', frase: f })}
              alEliminar={(f) => setAccion({ tipo: 'eliminar', frase: f })}
            />
          </div>
        );
      })}

      <Modal
        abierto={accion?.tipo === 'crear' || accion?.tipo === 'editar'}
        titulo={accion?.tipo === 'editar' ? 'Editar frase' : 'Agregar frase'}
        alCerrar={cerrar}
      >
        {(accion?.tipo === 'crear' || accion?.tipo === 'editar') && (
          <FraseForm
            frase={accion.tipo === 'editar' ? frase : null}
            inicial={accion.inicial}
            mutacion={accion.tipo === 'editar' ? editar : crear}
            alTerminar={cerrar}
            alCancelar={cerrar}
          />
        )}
      </Modal>

      <ConfirmarModal
        abierto={accion?.tipo === 'activo'}
        titulo={accion?.activo ? 'Activar frase' : 'Desactivar frase'}
        mensaje={
          accion?.activo
            ? `El bot podrá volver a usar «${frase?.frase}» desde el siguiente mensaje.`
            : `El bot dejará de usar «${frase?.frase}» desde el siguiente mensaje.`
        }
        textoConfirmar={accion?.activo ? 'Activar' : 'Desactivar'}
        cargando={cambiarActivo.isPending}
        error={cambiarActivo.error}
        alConfirmar={() =>
          cambiarActivo.mutate(
            { id: frase.id, activo: accion.activo, version: frase.version },
            { onSuccess: cerrar },
          )
        }
        alCancelar={cerrar}
      />

      <Modal abierto={accion?.tipo === 'eliminar'} titulo="Eliminar frase" alCerrar={cerrar}>
        {accion?.tipo === 'eliminar' && (
          <div className="space-y-4 text-sm">
            <p>
              ¿Eliminar «{frase.frase}»? No se puede deshacer.{' '}
              {frase.activo && 'Si solo quieres que el bot deje de usarla, mejor desactívala.'}
            </p>
            <MensajeError error={eliminar.error ?? cambiarActivo.error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Boton variante="secundario" onClick={cerrar}>
                Cancelar
              </Boton>
              {frase.activo && (
                <Boton
                  variante="secundario"
                  cargando={cambiarActivo.isPending}
                  onClick={() =>
                    cambiarActivo.mutate(
                      { id: frase.id, activo: false, version: frase.version },
                      { onSuccess: cerrar },
                    )
                  }
                >
                  Desactivar en su lugar
                </Boton>
              )}
              <Boton
                variante="peligro"
                cargando={eliminar.isPending}
                onClick={() =>
                  eliminar.mutate({ id: frase.id, version: frase.version }, { onSuccess: cerrar })
                }
              >
                Eliminar
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

// Interruptor cierre_automatico (eco_configuracion). Apagarlo deja al bot sin cierre en todos los mensajes.
function CierreAutomatico({ puedeEditar }) {
  const { data: interruptores } = useInterruptores();
  const cambiar = useCambiarCierreAutomatico();
  const [confirmar, setConfirmar] = useState(null);
  const cierre = interruptores?.find((i) => i.clave === 'cierre_automatico');
  if (!interruptores) return null;
  if (!cierre)
    return (
      <p className="text-sm text-alerta">
        No existe la clave cierre_automatico en eco_configuracion.
      </p>
    );

  const cerrar = () => {
    setConfirmar(null);
    cambiar.reset();
  };
  return (
    <div className="flex items-start gap-4 rounded-lg border border-borde bg-panel p-4">
      <Toggle
        activo={cierre.habilitado}
        etiqueta="Cierre automático"
        deshabilitado={!puedeEditar}
        alCambiar={(habilitado) => setConfirmar(habilitado)}
      />
      <div>
        <h3 className="font-medium">
          Cierre automático{' '}
          <span className={cierre.habilitado ? 'text-acento' : 'text-tenue'}>
            · {cierre.habilitado ? 'Encendido' : 'Apagado'}
          </span>
        </h3>
        <p className="text-sm text-tenue">
          Encendido, el bot termina sus mensajes con una de estas frases. Apagado, no agrega
          ninguna.
        </p>
      </div>
      <ConfirmarModal
        abierto={confirmar !== null}
        titulo={confirmar ? 'Encender cierre automático' : 'Apagar cierre automático'}
        mensaje={
          confirmar
            ? 'El bot volverá a terminar sus mensajes con una frase de cierre desde el siguiente mensaje.'
            : 'El bot dejará de agregar frases de cierre en todos sus mensajes.'
        }
        textoConfirmar={confirmar ? 'Encender' : 'Apagar'}
        cargando={cambiar.isPending}
        error={cambiar.error}
        alConfirmar={() => cambiar.mutate(confirmar, { onSuccess: cerrar })}
        alCancelar={cerrar}
      />
    </div>
  );
}

function Ayuda() {
  return (
    <details className="rounded-lg border border-borde bg-panel p-4 text-sm">
      <summary className="cursor-pointer font-medium">Cómo elige el bot la frase</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-tenue">
        <li>
          El bot de compras usa las frases GLOBAL + Compras; el de atención al cliente, GLOBAL +
          Atención.
        </li>
        {SITUACIONES_FRASE.map((s) => (
          <li key={s}>
            <strong className="text-texto">{INFO_SITUACIONES[s].titulo}:</strong>{' '}
            {INFO_SITUACIONES[s].cuando}
          </li>
        ))}
        <li>Si no hay frases activas para la situación, usa las de General.</li>
        <li>Elige al azar entre las que todavía no usó en esa conversación: no las repite.</li>
        <li>
          No pone cierre cuando pide el nombre, cuando pasa con un asesor, cuando el cliente se
          despide o cuando el mensaje ya termina con una pregunta.
        </li>
        <li>
          Recomendación: al menos {FRASES_RECOMENDADAS} frases por situación para que suene variado.
        </li>
      </ul>
    </details>
  );
}
