import { useState } from 'react';
import {
  EVENTOS_USUARIO,
  MOTIVOS_ACCESO_FALLIDO,
  MOTIVOS_FIN_SESION,
  duracionLegible,
  esquemaFiltrosAccesos,
  navegadorLegible,
  ultimosDias,
} from '@ecofiltro/shared';
import { claseFiltro } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Tarjeta } from '../reportes/Tarjeta.jsx';
import { fechaHora } from '../reportes/formato.js';
import { useAccesos } from './hooks.js';

const RANGOS = [
  { dias: 1, texto: 'Hoy' },
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
];

const fecha = (iso) => (iso ? fechaHora(iso) : '—');

function EnLinea() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs text-acento">
      <span className="h-2 w-2 rounded-full bg-acento" />
      En línea
    </span>
  );
}

// «rol: admin → lectura», «contraseña incorrecta», «15 min»…
export function detalleEvento({ evento, detalle }) {
  if (!detalle) return '—';
  if (evento === 'acceso_fallido') return MOTIVOS_ACCESO_FALLIDO[detalle.motivo] ?? detalle.motivo;
  if (evento === 'bloqueo') return `por ${detalle.minutos} min`;
  if (evento === 'creado') return `rol ${detalle.rol}`;
  if (evento === 'editado') {
    return Object.entries(detalle)
      .map(([campo, { antes, despues }]) => `${campo}: ${antes} → ${despues}`)
      .join(' · ');
  }
  return '—';
}

function Filtros({ filtros, alCambiar, usuarios }) {
  const cambiar = (campo) => (e) => alCambiar({ ...filtros, [campo]: e.target.value });
  const esRango = (dias) => {
    const r = ultimosDias(dias);
    return r.desde === filtros.desde && r.hasta === filtros.hasta;
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg bg-panel-2 p-1" role="group" aria-label="Rango rápido">
        {RANGOS.map(({ dias, texto }) => (
          <button
            key={dias}
            type="button"
            aria-pressed={esRango(dias)}
            onClick={() => alCambiar({ ...filtros, ...ultimosDias(dias) })}
            className={`rounded-md px-3 py-1 text-sm ${esRango(dias) ? 'bg-panel font-medium shadow-sm' : 'text-tenue'}`}
          >
            {texto}
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
      <select
        value={filtros.usuarioId}
        onChange={cambiar('usuarioId')}
        className={claseFiltro}
        aria-label="Usuario"
      >
        <option value="">Todos los usuarios</option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

const usuarioCelda = (f) => (
  <>
    <div>
      {f.nombre ?? f.correo}
      {f.enLinea && <EnLinea />}
    </div>
    {f.nombre && <div className="text-[11px] text-apagado">{f.correo}</div>}
  </>
);

export function ControlAccesos({ usuarios }) {
  const [filtros, setFiltros] = useState({ ...ultimosDias(7), usuarioId: '' });
  const validacion = esquemaFiltrosAccesos.safeParse(filtros);
  const { data, isPending, isFetching, error } = useAccesos(filtros, validacion.success);
  const enLinea = data?.resumen.filter((r) => r.enLinea).length ?? 0;

  return (
    <div className="space-y-4">
      <Filtros filtros={filtros} alCambiar={setFiltros} usuarios={usuarios} />
      {!validacion.success && (
        <p className="text-sm text-peligro">{validacion.error.issues[0].message}</p>
      )}
      <MensajeError error={error} />
      {isPending && validacion.success && <p className="text-tenue">Cargando…</p>}

      {data && (
        <div className={`space-y-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <Tarjeta titulo="Por usuario" subtitulo={`${enLinea} en línea ahora`}>
            <Tabla
              clave={(r) => r.usuarioId}
              filas={data.resumen}
              vacio="Sin usuarios"
              columnas={[
                { titulo: 'Usuario', celda: usuarioCelda },
                {
                  titulo: 'Sesiones',
                  className: 'text-right tabular-nums',
                  celda: (r) => r.sesiones,
                },
                {
                  titulo: 'Tiempo en la app',
                  className: 'whitespace-nowrap',
                  celda: (r) => (r.sesiones ? duracionLegible(r.minutos) : '—'),
                },
                { titulo: 'Primera entrada', celda: (r) => fecha(r.primeraEntrada) },
                {
                  titulo: 'Última salida',
                  celda: (r) => (r.enLinea ? 'En la app' : fecha(r.ultimaSalida)),
                },
                {
                  titulo: 'Accesos fallidos',
                  className: 'text-right tabular-nums',
                  celda: (r) =>
                    r.fallidos ? <span className="text-alerta">{r.fallidos}</span> : 0,
                },
              ]}
            />
          </Tarjeta>

          <Tarjeta titulo="Entradas y salidas" subtitulo={`${data.sesiones.length} sesión(es)`}>
            <Tabla
              clave={(s) => s.id}
              filas={data.sesiones}
              vacio="Nadie entró en el periodo"
              columnas={[
                { titulo: 'Usuario', celda: usuarioCelda },
                {
                  titulo: 'Entrada',
                  className: 'whitespace-nowrap',
                  celda: (s) => fecha(s.inicio),
                },
                {
                  titulo: 'Salida',
                  className: 'whitespace-nowrap',
                  celda: (s) => (s.motivo === 'abierta' ? '—' : fecha(s.fin)),
                },
                {
                  titulo: 'Duración',
                  className: 'whitespace-nowrap',
                  celda: (s) => duracionLegible(s.minutos),
                },
                { titulo: 'Cómo terminó', celda: (s) => MOTIVOS_FIN_SESION[s.motivo] },
                {
                  titulo: 'Equipo',
                  celda: (s) => (
                    <>
                      <div className="text-xs">{navegadorLegible(s.navegador) ?? '—'}</div>
                      <div className="font-mono text-[11px] text-apagado">{s.ip ?? ''}</div>
                    </>
                  ),
                },
              ]}
            />
          </Tarjeta>

          <Tarjeta
            titulo="Movimientos"
            subtitulo="Accesos fallidos, bloqueos y cambios a los usuarios"
          >
            <Tabla
              clave={(e) => e.id}
              filas={data.eventos}
              vacio="Sin movimientos en el periodo"
              columnas={[
                {
                  titulo: 'Fecha',
                  className: 'whitespace-nowrap',
                  celda: (e) => fecha(e.creadoEn),
                },
                { titulo: 'Usuario', celda: usuarioCelda },
                {
                  titulo: 'Movimiento',
                  celda: (e) => (
                    <span
                      className={
                        e.evento === 'acceso_fallido' || e.evento === 'bloqueo' ? 'text-alerta' : ''
                      }
                    >
                      {EVENTOS_USUARIO[e.evento]}
                    </span>
                  ),
                },
                {
                  titulo: 'Detalle',
                  celda: (e) => <span className="text-xs">{detalleEvento(e)}</span>,
                },
                { titulo: 'Hecho por', celda: (e) => e.hechoPor ?? '—' },
                { titulo: 'IP', className: 'font-mono text-[11px]', celda: (e) => e.ip ?? '—' },
              ]}
            />
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
