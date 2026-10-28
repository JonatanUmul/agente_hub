import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { esquemaFiltrosReporte, ultimosDias } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { useAgentes } from '../agentes/hooks.js';
import { usePermiso } from '../auth/hooks.js';
import { urlExportar } from './api.js';
import { Barras } from './Barras.jsx';
import { FrasesActivas } from './FrasesActivas.jsx';
import { FiltrosReporte } from './FiltrosReporte.jsx';
import { GraficosPorDia } from './GraficosPorDia.jsx';
import { MapaCalor } from './MapaCalor.jsx';
import { Tarjeta } from './Tarjeta.jsx';
import { Tarjetas } from './Tarjetas.jsx';
import { diaCorto, entero, fechaHora, motivoLegible, porcentajeEntre } from './formato.js';
import { useDetalle, useReporte } from './hooks.js';

const CAMPOS = ['desde', 'hasta', 'modulo', 'bandeja', 'agente'];

// Los filtros viven en la URL: se puede compartir o recargar el mismo recorte.
function useFiltros() {
  const [params, setParams] = useSearchParams();
  const porDefecto = ultimosDias(30);
  const filtros = Object.fromEntries(CAMPOS.map((c) => [c, params.get(c) ?? porDefecto[c] ?? '']));
  const cambiar = (nuevos) =>
    setParams(Object.fromEntries(Object.entries(nuevos).filter(([, v]) => v)), { replace: true });
  return [filtros, cambiar];
}

export function ReportesPage() {
  const [filtros, setFiltros] = useFiltros();
  const validacion = esquemaFiltrosReporte.safeParse(filtros);
  const { data: reporte, error, isPending, isFetching } = useReporte(filtros, validacion.success);
  const { data: agentes = [] } = useAgentes();
  const puedeExportar = usePermiso('reportes:exportar');
  const exportar = (tabla) =>
    puedeExportar && (
      <a
        href={urlExportar(tabla, filtros)}
        download
        className="text-sm text-acento hover:underline"
      >
        Exportar CSV
      </a>
    );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Reportes del bot</h2>
        <p className="text-sm text-tenue">
          Cómo está funcionando el bot de WhatsApp. Solo datos agregados: ningún mensaje ni dato de
          clientes. Se actualiza cada 5 minutos.
        </p>
      </div>

      <FiltrosReporte filtros={filtros} alCambiar={setFiltros} agentes={agentes} />
      {!validacion.success && (
        <p className="text-sm text-peligro">{validacion.error.issues[0].message}</p>
      )}
      {error?.codigo === 'REPORTES_NO_CONFIGURADOS' ? (
        <p className="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm">
          {error.message} Lo configura el administrador con{' '}
          <code>docs/sql/rol_eco_reportes.sql</code>.
        </p>
      ) : (
        <MensajeError error={error} />
      )}
      {isPending && validacion.success && !error && <p className="text-tenue">Calculando…</p>}

      {reporte && (
        // Al cambiar un filtro se conservan los datos anteriores, atenuados, hasta que llegan los nuevos.
        <div className={`space-y-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <p className="text-xs text-apagado">
            Del {diaCorto(reporte.periodo.desde)} al {diaCorto(reporte.periodo.hasta)}, comparado
            con el {diaCorto(reporte.periodoAnterior.desde)} al{' '}
            {diaCorto(reporte.periodoAnterior.hasta)} · calculado {fechaHora(reporte.generadoEn)}
          </p>
          <Tarjetas tarjetas={reporte.tarjetas} tiempoAsignacion={reporte.tiempoAsignacion} />
          <Contenido reporte={reporte} exportar={exportar} />
          <Detalle filtros={filtros} exportar={exportar} />
          <Limitaciones />
        </div>
      )}
    </section>
  );
}

function Contenido({ reporte, exportar }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GraficosPorDia porDia={reporte.porDia} />
      <Tarjeta
        titulo="Horas pico"
        subtitulo="Mensajes de la bandeja por día de la semana y hora (Guatemala)"
        className="lg:col-span-2"
      >
        <MapaCalor horasPico={reporte.horasPico} />
      </Tarjeta>
      <Tarjeta
        titulo="Conversaciones por módulo"
        subtitulo="Una conversación puede pasar por varios"
      >
        <Barras
          filas={reporte.porModulo.map((m) => ({
            clave: m.modulo,
            etiqueta: m.modulo,
            valor: m.conversaciones,
          }))}
        />
      </Tarjeta>
      <Tarjeta titulo="Avisos de fuera de horario">
        <Barras
          filas={reporte.fueraDeHorario.map((f) => ({
            clave: f.motivo ?? 'sin-motivo',
            etiqueta: motivoLegible(f.motivo),
            valor: f.avisos,
          }))}
        />
      </Tarjeta>
      <Tarjeta
        titulo="Transferencias por agente"
        subtitulo="Chats asignados a cada asesor"
        acciones={exportar('agentes')}
      >
        <Barras
          filas={reporte.porAgente.map((a) => ({
            clave: a.agenteId,
            etiqueta: a.agente,
            detalle: `${a.bandeja} · ${entero(a.conversaciones)} conversación(es)`,
            valor: a.chats,
          }))}
        />
      </Tarjeta>
      <Tarjeta
        titulo="Pautas"
        subtitulo="Conversaciones que llegaron por cada pauta"
        acciones={exportar('pautas')}
      >
        <Tabla
          clave={(p) => p.codigo}
          filas={reporte.porPauta}
          vacio="Ninguna conversación llegó por una pauta"
          columnas={[
            {
              titulo: 'Pauta',
              celda: (p) => <NombreConCodigo nombre={p.pauta} codigo={p.codigo} />,
            },
            {
              titulo: 'Conv.',
              className: 'text-right tabular-nums',
              celda: (p) => entero(p.conversaciones),
            },
            {
              titulo: 'A asesor',
              className: 'text-right tabular-nums',
              celda: (p) =>
                `${entero(p.transferidas)} (${porcentajeEntre(p.transferidas, p.conversaciones)})`,
            },
          ]}
        />
      </Tarjeta>
      <FrasesActivas />
      <Tarjeta titulo="Preguntas frecuentes más usadas" acciones={exportar('preguntas')}>
        <Tabla
          clave={(q) => q.numero}
          filas={reporte.preguntas}
          vacio="El bot no usó preguntas frecuentes"
          columnas={[
            { titulo: '#', className: 'tabular-nums', celda: (q) => q.numero },
            { titulo: 'Pregunta', celda: (q) => q.pregunta },
            {
              titulo: 'Veces',
              className: 'text-right tabular-nums',
              celda: (q) => entero(q.veces),
            },
          ]}
        />
      </Tarjeta>
      <Tarjeta
        titulo="Fotos y videos más enviados"
        subtitulo="Es la mejor aproximación a los productos más consultados"
        acciones={exportar('multimedia')}
      >
        <Tabla
          clave={(m) => `${m.tipo}-${m.descripcion}-${m.productoCodigo}`}
          filas={reporte.multimedia}
          vacio="El bot no envió fotos ni videos"
          columnas={[
            {
              titulo: 'Archivo',
              celda: (m) => <NombreConCodigo nombre={m.descripcion} codigo={m.tipo} />,
            },
            { titulo: 'Producto', celda: (m) => m.producto ?? '—' },
            {
              titulo: 'Envíos',
              className: 'text-right tabular-nums',
              celda: (m) => entero(m.envios),
            },
          ]}
        />
      </Tarjeta>
    </div>
  );
}

function NombreConCodigo({ nombre, codigo }) {
  return (
    <>
      <div>{nombre}</div>
      <div className="font-mono text-[11px] text-apagado">{codigo}</div>
    </>
  );
}

// El detalle se pide solo cuando alguien lo abre: es la consulta más pesada.
function Detalle({ filtros, exportar }) {
  const [abierto, setAbierto] = useState(false);
  const { data: filas, isPending, error } = useDetalle(filtros, abierto);
  return (
    <Tarjeta
      titulo="Detalle por conversación"
      subtitulo="Sin teléfono, nombre ni mensajes. Máximo 500, las más recientes."
      acciones={
        <>
          {exportar('detalle')}
          <Boton variante="enlace" onClick={() => setAbierto(!abierto)}>
            {abierto ? 'Ocultar' : 'Ver detalle'}
          </Boton>
        </>
      }
    >
      {abierto && isPending && <p className="text-tenue">Cargando…</p>}
      <MensajeError error={error} />
      {abierto && filas && (
        <Tabla
          clave={(f) => f.conversacion}
          filas={filas}
          vacio="Sin conversaciones en el periodo"
          columnas={[
            {
              titulo: 'Conversación',
              className: 'font-mono text-xs',
              celda: (f) => f.conversacion,
            },
            { titulo: 'Inicio', celda: (f) => fechaHora(f.inicio) },
            { titulo: 'Módulos', celda: (f) => f.modulos.join(', ') || '—' },
            { titulo: 'A asesor', celda: (f) => (f.transferida ? 'Sí' : 'No') },
            { titulo: 'Pauta', className: 'font-mono text-xs', celda: (f) => f.pauta ?? '—' },
          ]}
        />
      )}
    </Tarjeta>
  );
}

// Lo que se pidió pero los datos actuales no permiten medir (docs/reportes-indicadores.md).
function Limitaciones() {
  return (
    <details className="rounded-lg border border-borde bg-panel p-4 text-sm">
      <summary className="cursor-pointer font-medium">Qué no se puede medir todavía</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-tenue">
        <li>El motivo por el que una conversación pasa a asesor: n8n no lo registra.</li>
        <li>Cuánto dura la atención del asesor: la hora de cierre de los chats no se guarda.</li>
        <li>
          Qué producto consultó el cliente: se aproxima con las fotos y videos enviados de cada
          producto.
        </li>
        <li>
          «Cambiaron de módulo» cuenta conversaciones que pasaron por más de un módulo, sin el orden
          ni el motivo.
        </li>
      </ul>
    </details>
  );
}
