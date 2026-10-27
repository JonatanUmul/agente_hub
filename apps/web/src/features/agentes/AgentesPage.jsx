import { useMemo, useState } from 'react';
import { Boton } from '../../components/Boton.jsx';
import { claseFiltro } from '../../components/Campo.jsx';
import { EnlaceHistorial } from '../../components/EnlaceHistorial.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { usePermiso } from '../auth/hooks.js';
import { Descansos } from './Descansos.jsx';
import { HorarioSemanal } from './HorarioSemanal.jsx';
import { fechaCorta, nombreAgente, resumenSemana } from './formato.js';
import { useAgentes, useAgregarDescanso, useGuardarHorario, useQuitarDescanso } from './hooks.js';

function EstadoAhora({ enHorario }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] ${
        enHorario
          ? 'border-acento/30 bg-acento/10 text-acento'
          : 'border-borde-fuerte bg-panel-2 text-tenue'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${enHorario ? 'bg-acento' : 'bg-apagado'}`} />
      {enHorario ? 'En horario' : 'Fuera de horario'}
    </span>
  );
}

// Una letra por día; resaltada si trabaja. El detalle de horas aparece al pasar el cursor.
function Semana({ horario }) {
  return (
    <div className="flex gap-1">
      {resumenSemana(horario).map((d) => (
        <span
          key={d.dia}
          title={`${d.nombre}: ${d.trabaja ? d.texto : 'descansa'}`}
          className={`flex h-6 w-8 items-center justify-center rounded text-[11px] ${
            d.trabaja ? 'bg-acento/15 font-medium text-acento' : 'bg-panel-2 text-apagado'
          }`}
        >
          {d.corto}
        </span>
      ))}
    </div>
  );
}

export function AgentesPage() {
  const { data: agentes, isPending, error } = useAgentes();
  const puedeEditar = usePermiso('horarios:editar');
  const guardar = useGuardarHorario();
  const agregar = useAgregarDescanso();
  const quitar = useQuitarDescanso();
  const [soloActivos, setSoloActivos] = useState(true);
  const [texto, setTexto] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (agentes ?? []).filter(
      (a) =>
        (!soloActivos || a.estadoAgente === 'activo') &&
        (!t ||
          [nombreAgente(a), a.email, a.bandeja ?? ''].some((v) => v.toLowerCase().includes(t))),
    );
  }, [agentes, soloActivos, texto]);

  if (isPending) return <p className="text-tenue">Cargando agentes…</p>;
  if (error) return <MensajeError error={error} />;

  // Se busca en cada render para que el modal muestre siempre la versión más reciente.
  const editando = agentes.find((a) => a.id === editandoId);
  const cerrar = () => {
    setEditandoId(null);
    [guardar, agregar, quitar].forEach((m) => m.reset());
  };
  const enHorario = visibles.filter((a) => a.enHorarioAhora).length;

  const columnas = [
    {
      titulo: 'Agente',
      celda: (a) => (
        <>
          <div className="font-medium">{nombreAgente(a)}</div>
          <div className="text-xs text-tenue">{a.email}</div>
        </>
      ),
    },
    { titulo: 'Bandeja', celda: (a) => a.bandeja ?? <span className="text-apagado">—</span> },
    { titulo: 'Ahora', celda: (a) => <EstadoAhora enHorario={a.enHorarioAhora} /> },
    { titulo: 'Semana', celda: (a) => <Semana horario={a.horario} /> },
    {
      titulo: 'Próximo descanso',
      celda: (a) =>
        a.descansos[0] ? (
          <span className="text-xs">
            {fechaCorta(a.descansos[0].desde)}
            {a.descansos[0].motivo && (
              <span className="text-tenue"> · {a.descansos[0].motivo}</span>
            )}
          </span>
        ) : (
          <span className="text-apagado">—</span>
        ),
    },
    {
      titulo: '',
      className: 'text-right whitespace-nowrap',
      celda: (a) => (
        <div className="flex justify-end gap-3">
          <EnlaceHistorial tabla="eco_agentes_horario" registroId={a.id} />
          <Boton variante="enlace" onClick={() => setEditandoId(a.id)}>
            {puedeEditar ? 'Editar horario' : 'Ver horario'}
          </Boton>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Horarios de agentes</h2>
        <p className="text-sm text-tenue">
          Días y horas en que cada agente atiende (hora de Guatemala). El bot solo pasa
          conversaciones a quien está en horario. Los agentes se sincronizan desde HubSpot.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Buscar nombre, correo o bandeja"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className={`${claseFiltro} w-64`}
        />
        <label className="flex items-center gap-2 text-sm text-tenue">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          Solo agentes activos
        </label>
        <span className="ml-auto text-xs text-tenue">
          {enHorario} de {visibles.length} en horario ahora
        </span>
      </div>

      <Tabla columnas={columnas} filas={visibles} vacio="Ningún agente coincide" />

      <Modal
        abierto={Boolean(editando)}
        titulo={editando ? `Horario de ${nombreAgente(editando)}` : ''}
        alCerrar={cerrar}
        ancho="max-w-3xl"
      >
        {editando && (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Semana</h3>
              {/* key: al guardar cambia la versión y el editor se reinicia con lo que quedó en la base. */}
              <HorarioSemanal
                key={editando.version}
                agente={editando}
                mutacion={guardar}
                puedeEditar={puedeEditar}
              />
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Días de descanso</h3>
              <Descansos
                agente={editando}
                agregar={agregar}
                quitar={quitar}
                puedeEditar={puedeEditar}
              />
            </section>
          </div>
        )}
      </Modal>
    </section>
  );
}
