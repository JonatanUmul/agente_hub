import { MODULOS_REPORTE, ultimosDias } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseFiltro } from '../../components/Campo.jsx';

const RANGOS = [7, 30, 90];

const nombreAgente = (a) => [a.nombre, a.apellido].filter(Boolean).join(' ') || `Agente ${a.id}`;

// Una fila de filtros arriba de todo el dashboard: todos los indicadores usan el mismo recorte.
// `agentes`: lista de hubspot_agentes (para elegir agente y bandeja).
export function FiltrosReporte({ filtros, alCambiar, agentes }) {
  const cambiar = (campo) => (e) => alCambiar({ ...filtros, [campo]: e.target.value });
  const bandejas = [
    ...new Set(agentes.map((a) => a.bandeja?.toLowerCase()).filter(Boolean)),
  ].sort();
  const esRango = (dias) => {
    const r = ultimosDias(dias);
    return r.desde === filtros.desde && r.hasta === filtros.hasta;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg bg-panel-2 p-1" role="group" aria-label="Rango rápido">
        {RANGOS.map((dias) => (
          <button
            key={dias}
            type="button"
            aria-pressed={esRango(dias)}
            onClick={() => alCambiar({ ...filtros, ...ultimosDias(dias) })}
            className={`rounded-md px-3 py-1 text-sm ${esRango(dias) ? 'bg-panel font-medium shadow-sm' : 'text-tenue'}`}
          >
            {dias} días
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1 text-xs text-tenue">
        Desde
        <input
          type="date"
          value={filtros.desde}
          onChange={cambiar('desde')}
          className={claseFiltro}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-tenue">
        Hasta
        <input
          type="date"
          value={filtros.hasta}
          onChange={cambiar('hasta')}
          className={claseFiltro}
        />
      </label>
      <select value={filtros.modulo} onChange={cambiar('modulo')} className={claseFiltro}>
        <option value="">Todos los módulos</option>
        {Object.keys(MODULOS_REPORTE).map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <select value={filtros.bandeja} onChange={cambiar('bandeja')} className={claseFiltro}>
        <option value="">Todas las bandejas</option>
        {bandejas.map((b) => (
          <option key={b}>{b}</option>
        ))}
      </select>
      <select value={filtros.agente} onChange={cambiar('agente')} className={claseFiltro}>
        <option value="">Todos los agentes</option>
        {agentes.map((a) => (
          <option key={a.id} value={String(a.id)}>
            {nombreAgente(a)}
          </option>
        ))}
      </select>
      {(filtros.modulo || filtros.bandeja || filtros.agente) && (
        <Boton
          variante="enlace"
          onClick={() => alCambiar({ ...filtros, modulo: '', bandeja: '', agente: '' })}
        >
          Quitar filtros
        </Boton>
      )}
    </div>
  );
}
