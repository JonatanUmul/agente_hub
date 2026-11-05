import { useState } from 'react';
import { BotonCopiar } from '../../components/BotonCopiar.jsx';
import { claseFiltro } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Tarjeta } from './Tarjeta.jsx';
import { fechaHora } from './formato.js';
import { useSeguimientosIa } from './hooks.js';

const DECISIONES = { enviado: 'Enviado', cerrado: 'Cerrado' };

// Decisiones del seguimiento con IA en el rango del dashboard. «Respondió»: el cliente escribió después.
export function SeguimientosIa({ desde, hasta }) {
  const [decision, setDecision] = useState('');
  const { data: filas, isPending, error } = useSeguimientosIa({ desde, hasta, decision }, true);
  const enviados = filas?.filter((f) => f.decision === 'enviado') ?? [];
  const respondieron = enviados.filter((f) => f.respondio).length;

  return (
    <Tarjeta
      titulo="Seguimientos de la IA"
      subtitulo={
        filas &&
        `${enviados.length} enviado(s) · ${respondieron} con respuesta · ${filas.length - enviados.length} cerrado(s)`
      }
      acciones={
        <select
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className={claseFiltro}
          aria-label="Decisión"
        >
          <option value="">Todas las decisiones</option>
          {Object.entries(DECISIONES).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      }
    >
      {isPending && <p className="text-tenue">Cargando…</p>}
      <MensajeError error={error} />
      {filas && (
        <Tabla
          clave={(f) => `${f.conversacion}-${f.fecha}`}
          filas={filas}
          vacio="Sin seguimientos en el periodo"
          columnas={[
            { titulo: 'Fecha', className: 'whitespace-nowrap', celda: (f) => fechaHora(f.fecha) },
            {
              titulo: 'Conversación',
              celda: (f) => (
                <span className="flex items-center gap-1 font-mono text-xs">
                  {f.conversacion}
                  <BotonCopiar texto={f.conversacion} />
                </span>
              ),
            },
            { titulo: 'Decisión', celda: (f) => DECISIONES[f.decision] },
            { titulo: 'Texto', celda: (f) => <span className="text-xs">{f.texto ?? '—'}</span> },
            {
              titulo: 'Respondió',
              celda: (f) => (f.decision === 'enviado' ? (f.respondio ? 'Sí' : 'No') : '—'),
            },
          ]}
        />
      )}
    </Tarjeta>
  );
}
