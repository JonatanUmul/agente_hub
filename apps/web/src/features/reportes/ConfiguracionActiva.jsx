import { Link } from 'react-router-dom';
import { PARAMETROS_ENTEROS, resumenMensajes } from '@ecofiltro/shared';
import { useParametros } from '../configuracion/hooks.js';
import { useMensajes } from '../mensajes/hooks.js';
import { Tarjeta } from './Tarjeta.jsx';

const PRINCIPALES = [
  'segundos_agrupar_mensajes',
  'minutos_aviso_inactividad',
  'minutos_cierre_inactividad',
  'minutos_espera_nombre',
  'max_fotos_pauta',
];

// Tiempos principales y mensajes con versiones activas por categoría.
export function ConfiguracionActiva() {
  const { data: parametros } = useParametros();
  const { data: mensajes } = useMensajes();
  const valor = (c) => parametros?.find((p) => p.clave === c)?.valor ?? '—';
  return (
    <Tarjeta
      titulo="Configuración activa"
      acciones={
        <>
          <Link to="/tiempos" className="text-sm text-acento hover:underline">
            Tiempos
          </Link>
          <Link to="/mensajes" className="text-sm text-acento hover:underline">
            Mensajes
          </Link>
        </>
      }
    >
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        {PRINCIPALES.map((c) => (
          <div key={c} className="contents">
            <dt className="text-tenue">{PARAMETROS_ENTEROS[c].titulo}</dt>
            <dd className="text-right tabular-nums">
              {valor(c)} {PARAMETROS_ENTEROS[c].unidad}
            </dd>
          </div>
        ))}
      </dl>
      {mensajes && (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-borde pt-3 text-sm">
          {resumenMensajes(mensajes).map((r) => (
            <div key={r.categoria} className="contents">
              <dt className="text-tenue">{r.categoria}</dt>
              <dd className={`text-right tabular-nums ${r.activos < r.total ? 'text-alerta' : ''}`}>
                {r.activos}/{r.total}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Tarjeta>
  );
}
