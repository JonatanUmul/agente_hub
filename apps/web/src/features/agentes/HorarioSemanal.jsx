import { useState } from 'react';
import { DIAS_SEMANA, esquemaGuardarHorario, finParaMostrar } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';

const RANGO_NUEVO = { horaInicio: '08:00', horaFin: '17:00' };

// Estado del editor: un día por fila, con sus rangos. Un día sin rangos = descansa.
const desdeAgente = (agente) =>
  agente.horario.map((d) => ({
    diaSemana: d.diaSemana,
    rangos: d.rangos.map((r) => ({ horaInicio: r.horaInicio, horaFin: finParaMostrar(r.horaFin) })),
  }));

// Errores de Zod → { [índice del día]: mensaje }.
function erroresPorDia(issues) {
  const errores = {};
  for (const issue of issues) {
    if (issue.path[0] === 'dias' && Number.isInteger(issue.path[1]))
      errores[issue.path[1]] ??= issue.message;
  }
  return errores;
}

export function HorarioSemanal({ agente, mutacion, puedeEditar }) {
  const [dias, setDias] = useState(() => desdeAgente(agente));
  const [errores, setErrores] = useState({});
  // El editor se reinicia al guardar (cambia la versión): el aviso sale del estado de la mutación,
  // que sobrevive al reinicio, y se oculta en cuanto se vuelve a editar.
  const [editado, setEditado] = useState(false);

  const cambiarDia = (indice, rangos) => {
    setDias(dias.map((d, i) => (i === indice ? { ...d, rangos } : d)));
    setEditado(true);
  };
  const copiar = (indice, destino) => {
    const rangos = dias[indice].rangos;
    setDias(
      dias.map((d) => (destino(d.diaSemana) ? { ...d, rangos: rangos.map((r) => ({ ...r })) } : d)),
    );
    setEditado(true);
  };

  const guardar = () => {
    const resultado = esquemaGuardarHorario.safeParse({ dias, version: agente.version });
    if (!resultado.success) return setErrores(erroresPorDia(resultado.error.issues));
    setErrores({});
    mutacion.mutate({ id: agente.id, ...resultado.data });
  };

  return (
    <div className="space-y-3">
      <div className="divide-y divide-borde rounded-lg border border-borde">
        {dias.map((d, i) => {
          const trabaja = d.rangos.length > 0;
          return (
            <div key={d.diaSemana} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
              <label className="flex w-32 items-center gap-2 pt-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={trabaja}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiarDia(i, e.target.checked ? [{ ...RANGO_NUEVO }] : [])}
                />
                <span className={trabaja ? '' : 'text-tenue'}>{DIAS_SEMANA[i].nombre}</span>
              </label>

              <div className="min-w-0 flex-1 space-y-1.5">
                {!trabaja && <p className="pt-1.5 text-sm text-apagado">Descansa</p>}
                {d.rangos.map((r, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={r.horaInicio}
                      disabled={!puedeEditar}
                      onChange={(e) =>
                        cambiarDia(
                          i,
                          d.rangos.map((x, k) =>
                            k === j ? { ...x, horaInicio: e.target.value } : x,
                          ),
                        )
                      }
                      className={`${claseControl} w-32`}
                      aria-label={`${DIAS_SEMANA[i].nombre}: inicio`}
                    />
                    <span className="text-tenue">a</span>
                    <input
                      type="time"
                      value={r.horaFin}
                      disabled={!puedeEditar}
                      onChange={(e) =>
                        cambiarDia(
                          i,
                          d.rangos.map((x, k) => (k === j ? { ...x, horaFin: e.target.value } : x)),
                        )
                      }
                      className={`${claseControl} w-32`}
                      aria-label={`${DIAS_SEMANA[i].nombre}: fin`}
                    />
                    {puedeEditar && (
                      <button
                        type="button"
                        onClick={() =>
                          cambiarDia(
                            i,
                            d.rangos.filter((_, k) => k !== j),
                          )
                        }
                        className="rounded px-2 py-1 text-xs text-tenue hover:bg-panel-2 hover:text-peligro"
                        aria-label="Quitar rango"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ))}
                {errores[i] && <p className="text-xs text-peligro">{errores[i]}</p>}
              </div>

              {puedeEditar && trabaja && (
                <div className="flex flex-col items-end gap-1 pt-1">
                  <Boton
                    variante="enlace"
                    className="text-xs"
                    onClick={() =>
                      cambiarDia(i, [...d.rangos, { horaInicio: '13:00', horaFin: '17:00' }])
                    }
                  >
                    + Rango
                  </Boton>
                  <Boton
                    variante="enlace"
                    className="text-xs"
                    onClick={() => copiar(i, (dia) => dia <= 5)}
                  >
                    Copiar a lun–vie
                  </Boton>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/**  <p className="text-xs text-apagado">
        Hora de Guatemala. 23:59 significa hasta medianoche. Varios rangos en un día = turno
        partido.
      </p>
      */}
      <MensajeError error={mutacion.error} />
      {puedeEditar && (
        <div className="flex items-center justify-end gap-3">
          {mutacion.isSuccess && !editado && (
            <span className="text-sm text-acento">Horario guardado</span>
          )}
          <Boton cargando={mutacion.isPending} onClick={guardar}>
            Guardar horario
          </Boton>
        </div>
      )}
    </div>
  );
}
