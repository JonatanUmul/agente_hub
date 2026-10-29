import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CATEGORIAS_MENSAJE } from '@ecofiltro/shared';
import { claseFiltro } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { usePermiso } from '../auth/hooks.js';
import { useParametros } from '../configuracion/hooks.js';
import { usePautas } from '../pautas/hooks.js';
import { useMensajes } from './hooks.js';
import { TarjetaMensaje } from './TarjetaMensaje.jsx';

const formatoFecha = new Intl.DateTimeFormat('es-GT', {
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Guatemala',
});

// Valores de ejemplo para los comodines: {minutos} = cierre − aviso; {pauta} y {vigencia} de una pauta vigente.
function useEjemplo() {
  const { data: parametros } = useParametros();
  const { data: pautas } = usePautas();
  return useMemo(() => {
    const valor = (c) => parametros?.find((p) => p.clave === c)?.valor;
    const aviso = valor('minutos_aviso_inactividad');
    const cierre = valor('minutos_cierre_inactividad');
    const pauta = pautas?.find((p) => p.vigente);
    return {
      minutos: Number.isInteger(aviso) && Number.isInteger(cierre) ? cierre - aviso : undefined,
      pauta: pauta?.nombre,
      vigencia: pauta?.vigenteHasta
        ? `, válida hasta el ${formatoFecha.format(new Date(pauta.vigenteHasta))}`
        : undefined,
    };
  }, [parametros, pautas]);
}

export function MensajesPage() {
  const { data: tipos, isPending, error } = useMensajes();
  const puedeEditar = usePermiso('mensajes:editar');
  const ejemplo = useEjemplo();
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const { hash } = useLocation();

  // Enlaces /mensajes#clave (desde Tiempos o Saludos): llevan a la tarjeta del mensaje.
  useEffect(() => {
    if (tipos && hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [tipos, hash]);

  if (isPending) return <p className="text-tenue">Cargando mensajes…</p>;
  if (error) return <MensajeError error={error} />;

  const buscar = texto.trim().toLowerCase();
  const visibles = tipos.filter(
    (t) =>
      (!categoria || t.categoria === categoria) &&
      (!buscar ||
        [t.titulo, t.clave, ...t.versiones.map((v) => v.texto)].some((x) =>
          x.toLowerCase().includes(buscar),
        )),
  );
  const categorias = [
    ...CATEGORIAS_MENSAJE,
    ...new Set(tipos.map((t) => t.categoria).filter((c) => !CATEGORIAS_MENSAJE.includes(c))),
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Mensajes del bot</h2>
      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Buscar texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className={`${claseFiltro} w-64`}
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className={claseFiltro}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {visibles.length === 0 && <p className="text-sm text-apagado">Sin resultados.</p>}
      {categorias.map((c) => {
        const deCategoria = visibles.filter((t) => t.categoria === c);
        if (deCategoria.length === 0) return null;
        return (
          <div key={c} className="space-y-3">
            <h3 className="font-medium">{c}</h3>
            {deCategoria.map((t) => (
              <TarjetaMensaje key={t.clave} tipo={t} ejemplo={ejemplo} puedeEditar={puedeEditar} />
            ))}
          </div>
        );
      })}
    </section>
  );
}
