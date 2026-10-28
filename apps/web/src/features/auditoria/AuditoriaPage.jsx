import { useSearchParams } from 'react-router-dom';
import { OPERACIONES_AUDITORIA, TABLAS_AUDITADAS } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseFiltro } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { fecha } from '../../lib/formato.js';
import { localAIso } from '../../lib/fechas.js';
import { useDiferido } from '../../lib/useDiferido.js';
import { nombreCampo, valorLegible } from '../../lib/valores.js';
import { useHistorial } from './hooks.js';

const CAMPOS_FILTRO = ['tabla', 'operacion', 'origen', 'registroId', 'usuario', 'desde', 'hasta'];
const NOMBRE_OPERACION = { INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Borró' };

// Los filtros viven en la URL: se puede compartir un enlace al historial de un registro.
export function AuditoriaPage() {
  const [params, setParams] = useSearchParams();
  const filtros = Object.fromEntries(CAMPOS_FILTRO.map((c) => [c, params.get(c) ?? '']));
  const consulta = useHistorial(
    useDiferido({
      ...filtros,
      // Las fechas del filtro se escriben en hora local; la API las recibe en ISO.
      desde: localAIso(filtros.desde),
      hasta: localAIso(filtros.hasta),
    }),
  );

  const cambiar = (campo) => (e) => {
    const siguientes = new URLSearchParams(params);
    if (e.target.value) siguientes.set(campo, e.target.value);
    else siguientes.delete(campo);
    setParams(siguientes, { replace: true });
  };
  const hayFiltros = CAMPOS_FILTRO.some((c) => filtros[c]);
  const entradas = consulta.data?.pages.flatMap((p) => p.entradas) ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Historial de cambios</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={filtros.tabla} onChange={cambiar('tabla')} className={claseFiltro}>
          <option value="">Todas las secciones</option>
          {Object.entries(TABLAS_AUDITADAS).map(([tabla, nombre]) => (
            <option key={tabla} value={tabla}>
              {nombre}
            </option>
          ))}
        </select>
        <select value={filtros.operacion} onChange={cambiar('operacion')} className={claseFiltro}>
          <option value="">Toda operación</option>
          {OPERACIONES_AUDITORIA.map((o) => (
            <option key={o} value={o}>
              {NOMBRE_OPERACION[o]}
            </option>
          ))}
        </select>
        <select value={filtros.origen} onChange={cambiar('origen')} className={claseFiltro}>
          <option value="">Desde cualquier lugar</option>
          <option value="app">Desde esta app</option>
          <option value="directo">Directo en la base</option>
        </select>
        <input
          placeholder="Correo"
          value={filtros.usuario}
          onChange={cambiar('usuario')}
          className={`${claseFiltro} w-52`}
        />
        <input
          placeholder="ID del registro"
          value={filtros.registroId}
          onChange={cambiar('registroId')}
          className={`${claseFiltro} w-36`}
        />
        <label className="flex items-center gap-1 text-sm text-tenue">
          Desde
          <input
            type="datetime-local"
            value={filtros.desde}
            onChange={cambiar('desde')}
            className={claseFiltro}
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-tenue">
          Hasta
          <input
            type="datetime-local"
            value={filtros.hasta}
            onChange={cambiar('hasta')}
            className={claseFiltro}
          />
        </label>
        {hayFiltros && (
          <Boton variante="enlace" onClick={() => setParams({}, { replace: true })}>
            Limpiar filtros
          </Boton>
        )}
      </div>

      {consulta.isPending && <p className="text-tenue">Cargando historial…</p>}
      <MensajeError error={consulta.error} />
      {!consulta.isPending && entradas.length === 0 && !consulta.error && (
        <p className="text-tenue">No hay cambios que coincidan con los filtros.</p>
      )}

      <ol className="divide-y divide-borde overflow-hidden rounded-lg border border-borde bg-panel empty:hidden">
        {entradas.map((e) => (
          <Entrada key={e.id} entrada={e} />
        ))}
      </ol>

      {consulta.hasNextPage && (
        <Boton
          variante="secundario"
          cargando={consulta.isFetchingNextPage}
          onClick={() => consulta.fetchNextPage()}
        >
          Cargar más
        </Boton>
      )}
    </section>
  );
}

function Entrada({ entrada: e }) {
  return (
    <li className="px-4 py-3 text-sm transition-colors hover:bg-panel-2/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="font-medium">
            {e.origen === 'app' ? e.usuarioApp : `Cambio directo en la base (rol ${e.usuarioDb})`}
          </span>{' '}
          {NOMBRE_OPERACION[e.operacion].toLowerCase()}{' '}
          <span className="text-tenue">{TABLAS_AUDITADAS[e.tabla]}:</span>{' '}
          <span className="font-medium">{e.etiqueta ?? `#${e.registroId}`}</span>
        </p>
        <time className="text-xs text-tenue" dateTime={e.creadoEn}>
          {fecha(e.creadoEn)}
        </time>
      </div>
      {e.origen === 'directo' && (
        <p className="mt-1 text-xs text-alerta">Cambio directo en la base.</p>
      )}
      {e.cambios.length > 0 &&
        (e.operacion === 'UPDATE' ? (
          <TablaCambiosAuditoria entrada={e} />
        ) : (
          // Altas y bajas traen la fila completa: plegada para que la lista se pueda leer.
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-acento">
              Ver datos ({e.cambios.length} campos)
            </summary>
            <TablaCambiosAuditoria entrada={e} />
          </details>
        ))}
    </li>
  );
}

function TablaCambiosAuditoria({ entrada: e }) {
  return (
    <table className="mt-2 w-full table-fixed text-xs">
      <tbody>
        {e.cambios.map((c) => (
          <tr key={c.campo} className="border-t border-borde align-top">
            <td className="w-40 py-1 pr-2 font-medium text-tenue">{nombreCampo(c.campo)}</td>
            {e.operacion !== 'INSERT' && (
              <td className="break-words py-1 pr-2 text-tenue line-through">
                {valorLegible(c.antes)}
              </td>
            )}
            {e.operacion !== 'DELETE' && (
              <td className="break-words py-1">{valorLegible(c.despues)}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
