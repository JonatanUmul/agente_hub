import { useState } from 'react';
import {
  MAX_ARTES_PAUTA,
  PARAMETROS_ENTEROS,
  esArte,
  imagenesDePauta,
  imagenesNoUsadas,
  loQueRecibeElCliente,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { GloboWhatsapp } from '../../components/GloboWhatsapp.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { useParametros } from '../configuracion/hooks.js';
import { useArchivos, useCambiarActivoArchivo, useCrearArtePauta } from '../multimedia/hooks.js';

// Recuadro del archivo: la app no tiene acceso a las imágenes de HubSpot, así que muestra descripción e ID.
function Miniatura({ archivo }) {
  return (
    <div className="flex h-24 w-24 shrink-0 flex-col justify-between rounded-md border border-borde-fuerte bg-panel-2 p-1.5 text-[10px]">
      <span className="line-clamp-3 text-texto">{archivo.descripcion}</span>
      <span className="truncate font-mono text-apagado">#{archivo.hubspotFileId}</span>
    </div>
  );
}

const Chip = ({ arte }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-[11px] ${arte ? 'bg-acento/15 text-acento' : 'bg-panel-2 text-tenue'}`}
  >
    {arte ? 'Arte' : 'Foto de producto'}
  </span>
);

function FormularioArte({ pauta, reemplaza, alTerminar }) {
  const crear = useCrearArtePauta();
  const [campos, setCampos] = useState({ hubspotFileId: '', descripcion: '' });
  const listo = campos.hubspotFileId.trim() && campos.descripcion.trim();
  const guardar = () =>
    crear.mutate(
      {
        pautaId: pauta.id,
        hubspotFileId: campos.hubspotFileId.trim(),
        descripcion: campos.descripcion.trim(),
        reemplaza: reemplaza ? { id: reemplaza.id, version: reemplaza.version } : null,
      },
      { onSuccess: alTerminar },
    );
  return (
    <div className="space-y-3 rounded-md border border-borde p-3">
      <p className="text-sm font-medium">
        {reemplaza ? `Reemplazar «${reemplaza.descripcion}»` : 'Agregar arte'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="ID del archivo en HubSpot">
          <input
            className={claseControl}
            value={campos.hubspotFileId}
            onChange={(e) => setCampos({ ...campos, hubspotFileId: e.target.value })}
          />
        </Campo>
        <Campo etiqueta="Descripción">
          <input
            className={claseControl}
            placeholder="Arte 15% de descuento"
            value={campos.descripcion}
            onChange={(e) => setCampos({ ...campos, descripcion: e.target.value })}
          />
        </Campo>
      </div>
      <MensajeError error={crear.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alTerminar}>
          Cancelar
        </Boton>
        <Boton disabled={!listo} cargando={crear.isPending} onClick={guardar}>
          {reemplaza ? 'Reemplazar' : 'Agregar'}
        </Boton>
      </div>
    </div>
  );
}

// Sección «Imagen de la pauta» en la edición de una pauta.
export function ImagenPauta({ pauta, puedeEditar }) {
  const { data: archivos, error } = useArchivos();
  const { data: parametros } = useParametros();
  const cambiarActivo = useCambiarActivoArchivo();
  const [formulario, setFormulario] = useState(null); // { reemplaza: archivo | null }

  if (error) return <MensajeError error={error} />;
  if (!archivos) return null;

  const maxFotos =
    parametros?.find((p) => p.clave === 'max_fotos_pauta')?.valor ??
    PARAMETROS_ENTEROS.max_fotos_pauta.porDefecto;
  const imagenes = imagenesDePauta(archivos, pauta.id);
  const noUsadas = imagenesNoUsadas(archivos, pauta.id);
  const recibe = loQueRecibeElCliente(archivos, pauta.id, maxFotos);

  return (
    <section className="space-y-3 border-t border-borde pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Imagen de la pauta</h3>
        {puedeEditar && !formulario && (
          <Boton variante="secundario" onClick={() => setFormulario({ reemplaza: null })}>
            Agregar arte
          </Boton>
        )}
      </div>

      {!recibe.conArte && (
        <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm">
          Sube una imagen de la pauta para no enviar fotos sueltas de cada color.
        </p>
      )}
      {recibe.artesActivos > 1 && (
        <p className="text-sm text-alerta">El bot enviará hasta {MAX_ARTES_PAUTA} imágenes.</p>
      )}
      {formulario && (
        <FormularioArte
          pauta={pauta}
          reemplaza={formulario.reemplaza}
          alTerminar={() => setFormulario(null)}
        />
      )}
      <MensajeError error={cambiarActivo.error} />

      {imagenes.length === 0 ? (
        <p className="text-sm text-apagado">Sin imágenes.</p>
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {imagenes.map((a) => (
            <li
              key={a.id}
              className={`flex items-center gap-3 p-2 ${a.activo ? '' : 'opacity-60'}`}
            >
              <Miniatura archivo={a} />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <Chip arte={esArte(a)} />
                <p className="truncate">{a.descripcion}</p>
                {a.producto && <p className="text-xs text-tenue">{a.producto.nombre}</p>}
              </div>
              <Toggle
                activo={a.activo}
                etiqueta={`Activa: ${a.descripcion}`}
                deshabilitado={!puedeEditar || cambiarActivo.isPending}
                alCambiar={(activo) =>
                  cambiarActivo.mutate({ id: a.id, activo, version: a.version })
                }
              />
              {puedeEditar && esArte(a) && (
                <Boton variante="enlace" onClick={() => setFormulario({ reemplaza: a })}>
                  Reemplazar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
      {noUsadas.length > 0 && (
        <p className="text-xs text-alerta">
          {noUsadas.length} archivo(s) asociados a varias pautas no se envían con esta (su pauta
          principal es otra).
        </p>
      )}

      <div className="rounded-md bg-panel-2 p-3">
        <p className="mb-2 text-sm font-medium">Esto recibe el cliente</p>
        {recibe.imagenes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {recibe.imagenes.map((a) => (
              <Miniatura key={a.id} archivo={a} />
            ))}
          </div>
        )}
        <GloboWhatsapp>{pauta.mensajeCliente || pauta.nombre}</GloboWhatsapp>
      </div>
    </section>
  );
}
