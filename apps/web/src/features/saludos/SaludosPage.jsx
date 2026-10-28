import { useState } from 'react';
import {
  NOMBRES_MODULO_SALUDO,
  ahoraEnGuatemala,
  tieneSaludoBase,
  vigenciaLegible,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseFiltro } from '../../components/Campo.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { EnlaceHistorial } from '../../components/EnlaceHistorial.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { usePermiso } from '../auth/hooks.js';
import {
  useCambiarActivoSaludo,
  useCrearSaludo,
  useEditarSaludo,
  useEliminarSaludo,
  useSaludos,
} from './hooks.js';
import { LineaTiempo } from './LineaTiempo.jsx';
import { SaludoForm } from './SaludoForm.jsx';

// Sin fechas = al principio al ordenar por fecha.
const ORDENES = {
  prioridad: (a, b) => b.prioridad - a.prioridad || a.id - b.id,
  fecha: (a, b) => (a.fechaInicio ?? '').localeCompare(b.fechaInicio ?? '') || a.id - b.id,
};

export function SaludosPage() {
  const { data: saludos, isPending, error } = useSaludos();
  const puedeEditar = usePermiso('saludos:editar');
  const [orden, setOrden] = useState('prioridad');
  const [accion, setAccion] = useState(null); // { tipo: 'crear' | 'editar' | 'activo' | 'eliminar', saludo? }
  const crear = useCrearSaludo();
  const editar = useEditarSaludo();
  const cambiarActivo = useCambiarActivoSaludo();
  const eliminar = useEliminarSaludo();

  if (isPending) return <p className="text-tenue">Cargando saludos…</p>;
  if (error) return <MensajeError error={error} />;

  const cerrar = () => {
    setAccion(null);
    [crear, editar, cambiarActivo, eliminar].forEach((m) => m.reset());
  };
  const { fecha: hoy } = ahoraEnGuatemala();
  const saludo = accion?.saludo;
  const columnas = [
    {
      titulo: 'Saludo',
      celda: (s) => (
        <div className="max-w-md">
          <div className="font-medium">
            {s.nombre}{' '}
            {s.vigenteHoy && (
              <span className="ml-1 rounded-full bg-acento/15 px-2 py-0.5 text-[11px] font-normal text-acento">
                Vigente hoy
              </span>
            )}
          </div>
          <div className="text-xs text-tenue">{s.saludo}</div>
        </div>
      ),
    },
    {
      titulo: 'Módulo',
      celda: (s) => (
        <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] whitespace-nowrap text-tenue">
          {NOMBRES_MODULO_SALUDO[s.modulo]}
        </span>
      ),
    },
    { titulo: 'Vigencia', celda: (s) => vigenciaLegible(s) },
    { titulo: 'Prioridad', className: 'text-right tabular-nums', celda: (s) => s.prioridad },
    {
      titulo: 'Activo',
      celda: (s) => (
        <Toggle
          activo={s.activo}
          etiqueta={`Activo: ${s.nombre}`}
          deshabilitado={!puedeEditar}
          alCambiar={() => setAccion({ tipo: 'activo', saludo: s })}
        />
      ),
    },
    {
      titulo: '',
      className: 'text-right whitespace-nowrap',
      celda: (s) => (
        <div className="flex justify-end gap-3">
          <EnlaceHistorial tabla="eco_saludos" registroId={s.id} />
          {puedeEditar && (
            <>
              <Boton variante="enlace" onClick={() => setAccion({ tipo: 'editar', saludo: s })}>
                Editar
              </Boton>
              <Boton
                variante="enlace"
                className="!text-peligro"
                onClick={() => setAccion({ tipo: 'eliminar', saludo: s })}
              >
                Eliminar
              </Boton>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Saludos</h2>
        {puedeEditar && <Boton onClick={() => setAccion({ tipo: 'crear' })}>Agregar saludo</Boton>}
      </div>

      {!tieneSaludoBase(saludos) && (
        <p
          role="alert"
          className="rounded-md border border-peligro/30 bg-peligro/10 px-3 py-2 text-sm text-peligro"
        >
          Sin saludo base: el bot usará el saludo por defecto.
        </p>
      )}

      <div className="flex items-center justify-end gap-2 text-sm text-tenue">
        Ordenar por
        <select value={orden} onChange={(e) => setOrden(e.target.value)} className={claseFiltro}>
          <option value="prioridad">Prioridad</option>
          <option value="fecha">Fecha</option>
        </select>
      </div>
      <Tabla columnas={columnas} filas={[...saludos].sort(ORDENES[orden])} vacio="Sin saludos" />
      <LineaTiempo saludos={saludos} hoy={hoy} />

      <Modal
        abierto={accion?.tipo === 'crear' || accion?.tipo === 'editar'}
        titulo={accion?.tipo === 'editar' ? 'Editar saludo' : 'Agregar saludo'}
        alCerrar={cerrar}
        ancho="max-w-xl"
      >
        {(accion?.tipo === 'crear' || accion?.tipo === 'editar') && (
          <SaludoForm
            saludo={accion.tipo === 'editar' ? saludo : null}
            saludos={saludos}
            mutacion={accion.tipo === 'editar' ? editar : crear}
            alTerminar={cerrar}
            alCancelar={cerrar}
          />
        )}
      </Modal>

      <ConfirmarModal
        abierto={accion?.tipo === 'activo'}
        titulo={saludo?.activo ? 'Desactivar saludo' : 'Activar saludo'}
        mensaje={`«${saludo?.nombre}» ${saludo?.activo ? 'dejará de usarse' : 'podrá usarse'} desde el siguiente saludo.`}
        textoConfirmar={saludo?.activo ? 'Desactivar' : 'Activar'}
        cargando={cambiarActivo.isPending}
        error={cambiarActivo.error}
        alConfirmar={() =>
          cambiarActivo.mutate(
            { id: saludo.id, activo: !saludo.activo, version: saludo.version },
            { onSuccess: cerrar },
          )
        }
        alCancelar={cerrar}
      />

      <ConfirmarModal
        abierto={accion?.tipo === 'eliminar'}
        titulo="Eliminar saludo"
        mensaje={`¿Eliminar «${saludo?.nombre}»? No se puede deshacer.`}
        textoConfirmar="Eliminar"
        peligro
        cargando={eliminar.isPending}
        error={eliminar.error}
        alConfirmar={() =>
          eliminar.mutate({ id: saludo.id, version: saludo.version }, { onSuccess: cerrar })
        }
        alCancelar={cerrar}
      />
    </section>
  );
}
