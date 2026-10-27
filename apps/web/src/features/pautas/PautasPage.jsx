import { useState } from 'react';
import { Boton } from '../../components/Boton.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { fecha, porcentaje } from '../../lib/formato.js';
import { usePermiso } from '../auth/hooks.js';
import { useEstadoInterruptores } from '../configuracion/hooks.js';
import { EstadoVigencia } from './EstadoVigencia.jsx';
import { PautaForm } from './PautaForm.jsx';
import { useCambiarActivoPauta, useCrearPauta, useEditarPauta, usePautas } from './hooks.js';

export function PautasPage() {
  const { data: pautas, isPending, error } = usePautas();
  const { estado: interruptores } = useEstadoInterruptores();
  const puedeEditar = usePermiso('pautas:editar');
  const crear = useCrearPauta();
  const editar = useEditarPauta();
  const cambiarActivo = useCambiarActivoPauta();
  const [accion, setAccion] = useState(null); // { tipo: 'crear' | 'editar' | 'activo', pauta? }

  if (isPending) return <p className="text-slate-500">Cargando pautas…</p>;
  if (error) return <MensajeError error={error} />;

  const cerrar = () => {
    setAccion(null);
    [crear, editar, cambiarActivo].forEach((m) => m.reset());
  };

  const columnas = [
    {
      titulo: 'Pauta',
      celda: (p) => (
        <>
          <div className="font-medium">{p.nombre}</div>
          <div className="text-xs text-slate-500">{p.codigo}</div>
        </>
      ),
    },
    { titulo: 'Descuento', className: 'text-right', celda: (p) => porcentaje(p.descuentoPct) },
    {
      titulo: 'Vigencia',
      celda: (p) => (
        <div className="text-xs">
          <div>Desde: {p.vigenteDesde ? fecha(p.vigenteDesde) : 'sin límite'}</div>
          <div>Hasta: {p.vigenteHasta ? fecha(p.vigenteHasta) : 'sin límite'}</div>
        </div>
      ),
    },
    { titulo: 'Estado', celda: (p) => <EstadoVigencia estado={p.estadoVigencia} /> },
    {
      titulo: 'Asociados',
      celda: (p) => (
        <div className="text-xs">
          <div>{p.productosActivos} producto(s)</div>
          <div>{p.archivosActivos} archivo(s)</div>
        </div>
      ),
    },
    {
      titulo: 'Activa',
      celda: (p) => (
        <Toggle
          activo={p.activo}
          etiqueta={`Activa: ${p.nombre}`}
          deshabilitado={!puedeEditar}
          alCambiar={() => setAccion({ tipo: 'activo', pauta: p })}
        />
      ),
    },
    ...(puedeEditar
      ? [
          {
            titulo: '',
            className: 'text-right',
            celda: (p) => (
              <Boton variante="enlace" onClick={() => setAccion({ tipo: 'editar', pauta: p })}>
                Editar
              </Boton>
            ),
          },
        ]
      : []),
  ];

  const pauta = accion?.pauta;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Pautas y promociones</h2>
          {!interruptores.promociones_habilitadas && (
            <p className="text-sm text-amber-700">
              Las promociones están apagadas: el bot no menciona ninguna pauta, aunque esté vigente.
            </p>
          )}
        </div>
        {puedeEditar && <Boton onClick={() => setAccion({ tipo: 'crear' })}>Nueva pauta</Boton>}
      </div>
      <Tabla columnas={columnas} filas={pautas} vacio="No hay pautas" />

      <Modal
        abierto={accion?.tipo === 'crear' || accion?.tipo === 'editar'}
        titulo={accion?.tipo === 'crear' ? 'Nueva pauta' : `Editar ${pauta?.nombre}`}
        alCerrar={cerrar}
      >
        {(accion?.tipo === 'crear' || accion?.tipo === 'editar') && (
          <PautaForm
            pauta={accion.tipo === 'editar' ? pauta : null}
            mutacion={accion.tipo === 'crear' ? crear : editar}
            alTerminar={cerrar}
            alCancelar={cerrar}
          />
        )}
      </Modal>

      <ConfirmarModal
        abierto={accion?.tipo === 'activo'}
        titulo={pauta?.activo ? 'Desactivar pauta' : 'Activar pauta'}
        mensaje={pauta && <MensajeActivo pauta={pauta} />}
        textoConfirmar={pauta?.activo ? 'Desactivar' : 'Activar'}
        peligro={pauta?.activo}
        cargando={cambiarActivo.isPending}
        error={cambiarActivo.error}
        alConfirmar={() =>
          cambiarActivo.mutate(
            { id: pauta.id, activo: !pauta.activo, version: pauta.version },
            { onSuccess: cerrar },
          )
        }
        alCancelar={cerrar}
      />
    </section>
  );
}

function MensajeActivo({ pauta }) {
  if (!pauta.activo)
    return (
      <p>
        El bot volverá a mencionar &quot;{pauta.nombre}&quot; mientras esté dentro de su vigencia.
      </p>
    );
  return (
    <div className="space-y-2">
      <p>El bot dejará de mencionar &quot;{pauta.nombre}&quot; desde el siguiente mensaje.</p>
      {pauta.productosActivos > 0 && (
        <p>
          {pauta.productosActivos} producto(s) asociado(s) dejarán de tener el descuento de esta
          pauta.
        </p>
      )}
      {pauta.productosConDescuentoPropio > 0 && (
        <p className="text-amber-700">
          {pauta.productosConDescuentoPropio} de ellos perderán también su descuento propio mientras
          sigan asociados a una pauta inactiva.
        </p>
      )}
    </div>
  );
}
