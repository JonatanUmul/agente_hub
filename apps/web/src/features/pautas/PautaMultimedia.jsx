import { useState } from 'react';
import { useController } from 'react-hook-form';
import {
  MAX_ARTES_PAUTA,
  TIPOS_MULTIMEDIA,
  conSeleccion,
  loQueRecibeElCliente,
} from '@ecofiltro/shared';
import { claseFiltro } from '../../components/Campo.jsx';
import { GloboWhatsapp } from '../../components/GloboWhatsapp.jsx';
import { ChipArte, Miniatura } from './Miniatura.jsx';

const coincide = (a, texto) =>
  [a.descripcion, a.producto?.nombre, a.color, a.hubspotFileId]
    .filter(Boolean)
    .some((t) => t.toLowerCase().includes(texto));

function Archivo({ archivo, marcado, alternar, pautaId }) {
  // Con varias pautas, n8n lo envía solo con su pauta principal.
  const principal =
    marcado && archivo.pautaIdPrincipal !== null && archivo.pautaIdPrincipal !== pautaId
      ? archivo.pautas.find((p) => p.id === archivo.pautaIdPrincipal)
      : null;
  return (
    <li>
      <label className="flex items-center gap-3 rounded px-1.5 py-1 text-sm hover:bg-panel-2">
        <input type="checkbox" checked={marcado} onChange={() => alternar(archivo.id)} />
        <Miniatura archivo={archivo} chica />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-tenue">{archivo.tipo}</span>
            <ChipArte archivo={archivo} />
          </span>
          <span className="block truncate">{archivo.descripcion}</span>
          <span className="block text-xs text-tenue">
            {[archivo.producto?.nombre, archivo.color].filter(Boolean).join(' · ') || '—'}
          </span>
          {principal && (
            <span className="block text-xs text-alerta">
              Se envía con su pauta principal «{principal.nombre}».
            </span>
          )}
        </span>
      </label>
    </li>
  );
}

// Sección «Multimedia» del formulario de pauta: campo `multimediaIds` y lo que verá el cliente.
// Los archivos inactivos ya asociados no se muestran, pero se conservan en la selección.
export function PautaMultimedia({
  control,
  archivos,
  pautaId,
  productoIds,
  aplicaTodos,
  maxFotos,
  mensaje,
}) {
  const { field } = useController({ control, name: 'multimediaIds' });
  const [filtro, setFiltro] = useState({ texto: '', tipo: '', deModelos: false });

  const activos = archivos.filter((a) => a.activo);
  const idsActivos = new Set(activos.map((a) => a.id));
  const ocultos = field.value.filter((id) => !idsActivos.has(id));
  const alternar = (id) =>
    field.onChange(
      field.value.includes(id)
        ? field.value.filter((x) => x !== id)
        : [...field.value, id].sort((a, b) => a - b),
    );

  const texto = filtro.texto.trim().toLowerCase();
  const visibles = activos.filter(
    (a) =>
      (!texto || coincide(a, texto)) &&
      (!filtro.tipo || a.tipo === filtro.tipo) &&
      (!filtro.deModelos || (a.producto && (aplicaTodos || productoIds.includes(a.producto.id)))),
  );
  const recibe = loQueRecibeElCliente(
    conSeleccion(archivos, pautaId, field.value),
    pautaId,
    maxFotos,
  );
  const marcados = field.value.filter((id) => idsActivos.has(id)).length;

  return (
    <section className="space-y-3 border-t border-borde pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Multimedia</h3>
        <p className="text-xs text-tenue">{marcados} seleccionado(s)</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={claseFiltro}
          placeholder="Buscar"
          aria-label="Buscar archivo"
          value={filtro.texto}
          onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })}
        />
        <select
          className={claseFiltro}
          aria-label="Tipo de archivo"
          value={filtro.tipo}
          onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })}
        >
          <option value="">Todos los tipos</option>
          {TIPOS_MULTIMEDIA.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-tenue">
          <input
            type="checkbox"
            checked={filtro.deModelos}
            onChange={(e) => setFiltro({ ...filtro, deModelos: e.target.checked })}
          />
          Solo de los modelos seleccionados
        </label>
      </div>
      <ul className="max-h-72 overflow-y-auto rounded-md border border-borde-fuerte bg-fondo p-2">
        {visibles.length === 0 ? (
          <li className="p-1.5 text-sm text-apagado">Sin archivos.</li>
        ) : (
          visibles.map((a) => (
            <Archivo
              key={a.id}
              archivo={a}
              marcado={field.value.includes(a.id)}
              alternar={alternar}
              pautaId={pautaId}
            />
          ))
        )}
      </ul>
      {ocultos.length > 0 && (
        <p className="text-xs text-apagado">
          Además, {ocultos.length} archivo(s) inactivo(s) siguen asociados.
        </p>
      )}

      <div className="rounded-md bg-panel-2 p-3">
        <p className="text-sm font-medium">Lo que verá el cliente</p>
        <p className="mb-2 text-xs text-tenue">
          {recibe.conArte
            ? `Con arte: el bot envía solo los artes (hasta ${MAX_ARTES_PAUTA}).`
            : `Sin arte: el bot envía hasta ${maxFotos} foto(s) de producto.`}
        </p>
        {recibe.imagenes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {recibe.imagenes.map((a) => (
              <Miniatura key={a.id} archivo={a} />
            ))}
          </div>
        )}
        <GloboWhatsapp>{mensaje}</GloboWhatsapp>
      </div>
    </section>
  );
}
