import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MODULOS } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { BotonCopiar } from '../../components/BotonCopiar.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { fecha, monto, porcentaje } from '../../lib/formato.js';
import { valorLegible } from '../../lib/valores.js';
import { useContexto } from './hooks.js';

// Muestra, legible, el JSON que eco_contexto(modulo) entrega al bot en cada mensaje.
export function ContextoPage() {
  const [modulo, setModulo] = useState('SAC');
  const [verJson, setVerJson] = useState(false);
  const { data: contexto, isPending, isFetching, error, refetch } = useContexto(modulo);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">¿Qué ve el bot ahora?</h2>
        <p className="text-sm text-slate-600">
          Es exactamente lo que recibe el bot en su próximo mensaje, generado con{' '}
          <code>eco_contexto()</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {MODULOS.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === modulo}
              onClick={() => setModulo(m)}
              className={`rounded-md px-3 py-1 text-sm ${m === modulo ? 'bg-white font-medium shadow-sm' : 'text-slate-600'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <Boton variante="secundario" cargando={isFetching} onClick={() => refetch()}>
          Actualizar
        </Boton>
        <Boton variante="enlace" onClick={() => setVerJson(!verJson)}>
          {verJson ? 'Ver legible' : 'Ver JSON'}
        </Boton>
      </div>

      {isPending && <p className="text-slate-500">Consultando…</p>}
      <MensajeError error={error} />
      {contexto &&
        (verJson ? <VistaJson contexto={contexto} /> : <VistaLegible contexto={contexto} />)}
    </section>
  );
}

function VistaJson({ contexto }) {
  const texto = JSON.stringify(contexto, null, 2);
  return (
    <div className="space-y-2">
      <BotonCopiar texto={texto} etiqueta="Copiar JSON" />
      <pre className="max-h-[70vh] overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
        {texto}
      </pre>
    </div>
  );
}

function Seccion({ titulo, cantidad, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 font-medium">
        {titulo}{' '}
        {cantidad !== undefined && (
          <span className="text-sm font-normal text-slate-500">({cantidad})</span>
        )}
      </h3>
      {children}
    </section>
  );
}

const Estado = ({ activo, si, no }) => (
  <span className={activo ? 'text-emerald-700' : 'text-slate-500'}>{activo ? si : no}</span>
);

function VistaLegible({ contexto: c }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Generado: {fecha(c.generado_en)} · módulo {c.modulo}
      </p>

      <Seccion titulo="Interruptores">
        <p className="text-sm">
          Precios:{' '}
          <Estado
            activo={c.precios_habilitados}
            si="el bot da precios"
            no="el bot no da precios (pasa a un asesor)"
          />
        </p>
        <p className="text-sm">
          Promociones:{' '}
          <Estado
            activo={c.promociones_habilitadas}
            si="el bot menciona descuentos y pautas"
            no="el bot no menciona descuentos"
          />
        </p>
      </Seccion>

      <Seccion titulo="Reglas" cantidad={c.reglas.length}>
        {c.reglas.length === 0 && (
          <p className="text-sm text-slate-500">Ninguna regla activa para este módulo.</p>
        )}
        <ol className="space-y-2">
          {c.reglas.map((r) => (
            <li key={r.codigo} className="text-sm">
              <div className="text-xs text-slate-500">
                {r.codigo} · {r.categoria} · para {r.destino}
              </div>
              <div className="whitespace-pre-wrap">{r.regla}</div>
            </li>
          ))}
        </ol>
      </Seccion>

      <Seccion titulo="Catálogo" cantidad={c.catalogo.length}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1 pr-3">Producto</th>
                <th className="py-1 pr-3">Estado</th>
                <th className="py-1 pr-3">Colores</th>
                <th className="py-1 pr-3 text-right">Precio</th>
                <th className="py-1 pr-3">Pauta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.catalogo.map((p) => (
                <tr key={p.codigo}>
                  <td className="py-1 pr-3">
                    {p.nombre} <span className="font-mono text-xs text-slate-500">{p.codigo}</span>
                  </td>
                  <td className="py-1 pr-3">{p.estado}</td>
                  <td className="py-1 pr-3">{valorLegible(p.colores)}</td>
                  <td className="py-1 pr-3 text-right">
                    {/* El bot solo recibe precio si los precios están encendidos. */}
                    {p.precio_final !== undefined ? (
                      <>
                        {monto(p.precio_final)}
                        {p.descuento_pct && (
                          <span className="text-emerald-700">
                            {' '}
                            (−{porcentaje(p.descuento_pct)})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">sin precio</span>
                    )}
                  </td>
                  <td className="py-1 pr-3">{p.pauta ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Pautas vigentes" cantidad={c.pautas.length}>
        {!c.promociones_habilitadas && (
          <p className="text-sm text-slate-500">Promociones apagadas: el bot no recibe pautas.</p>
        )}
        <ul className="space-y-2">
          {c.pautas.map((p) => (
            <li key={p.codigo} className="text-sm">
              <span className="font-medium">{p.nombre}</span> · {porcentaje(p.descuento_pct)}
              {p.vigente_hasta && (
                <span className="text-slate-500"> · hasta {fecha(p.vigente_hasta)}</span>
              )}
              {p.mensaje && <div className="text-slate-700">“{p.mensaje}”</div>}
              {p.imagenes && (
                <div className="text-xs text-slate-500">Imágenes: {p.imagenes.join(', ')}</div>
              )}
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Multimedia" cantidad={c.multimedia.length}>
        <ul className="space-y-1 text-sm">
          {c.multimedia.map((m) => (
            <li key={`${m.tipo}-${m.file_id}`}>
              <span className="text-slate-500">{m.tipo}</span> {m.descripcion}{' '}
              <span className="font-mono text-xs text-slate-500">#{m.file_id}</span>
              {m.producto && <span className="text-xs text-slate-500"> · {m.producto}</span>}
              {m.color && <span className="text-xs text-slate-500"> · {m.color}</span>}
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Configuración" cantidad={Object.keys(c.configuracion).length}>
        <table className="text-sm">
          <tbody>
            {Object.entries(c.configuracion)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([clave, valor]) => (
                <tr key={clave}>
                  <td className="py-0.5 pr-4 font-mono text-xs text-slate-600">{clave}</td>
                  <td className="py-0.5">{valorLegible(valor)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Seccion>

      <p className="text-xs text-slate-500">
        Las preguntas frecuentes no forman parte de este contexto: el bot las lee aparte (
        <Link to="/preguntas" className="underline">
          ver preguntas
        </Link>
        ).
      </p>
    </div>
  );
}
