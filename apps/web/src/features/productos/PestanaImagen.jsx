import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import {
  MAX_FOTOS_REFERENCIA,
  MAX_PISTAS_VISUALES,
  esUrlPublica,
  urlPublicaDeArchivo,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { useArchivos } from '../multimedia/hooks.js';

// Miniatura de una foto de referencia. Si la URL no es válida o no carga, un recuadro vacío.
export function MiniaturaFoto({ url, color }) {
  const [fallo, setFallo] = useState(false);
  const clase = 'h-14 w-14 shrink-0 rounded-md border border-borde-fuerte bg-panel-2 object-cover';
  if (!esUrlPublica(url) || fallo) return <div className={clase} aria-hidden />;
  return (
    <img
      src={url}
      alt={color || 'Foto de referencia'}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={clase}
      onError={() => setFallo(true)}
    />
  );
}

// Imágenes de Multimedia del producto, para tomar su URL como foto de referencia.
function FotosDeMultimedia({ productoId, urlsUsadas, alElegir, alCerrar }) {
  const { data: archivos = [] } = useArchivos();
  const delProducto = archivos.filter((a) => a.producto?.id === productoId && a.tipo !== 'video');
  return (
    <div className="space-y-2 rounded-md border border-borde p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Fotos de Multimedia de este producto</p>
        <Boton variante="enlace" onClick={alCerrar}>
          Cerrar
        </Boton>
      </div>
      {delProducto.length === 0 && <p className="text-sm text-apagado">Sin fotos.</p>}
      <ul className="space-y-1">
        {delProducto.map((a) => {
          const url = urlPublicaDeArchivo(a);
          return (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {a.descripcion}
                {a.color && <span className="text-tenue"> · {a.color}</span>}
              </span>
              {!url ? (
                <span className="text-xs text-alerta">Esta foto no tiene URL pública</span>
              ) : urlsUsadas.includes(url) ? (
                <span className="text-xs text-tenue">Ya agregada</span>
              ) : (
                <Boton variante="enlace" onClick={() => alElegir({ url, color: a.color ?? '' })}>
                  Usar
                </Boton>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Pestaña «Identificación por imagen»: pistas visuales y fotos de referencia ([{ url, color }]).
export function PestanaImagen({ producto, register, control, errors, enVivo }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'fotosReferencia' });
  const [verMultimedia, setVerMultimedia] = useState(false);
  const errorFotos = errors.fotosReferencia?.message ?? errors.fotosReferencia?.root?.message;
  const lleno = fields.length >= MAX_FOTOS_REFERENCIA;
  const fotos = enVivo.fotosReferencia ?? [];

  return (
    <div className="space-y-4">
      <Campo
        etiqueta={`Pistas visuales (${enVivo.pistasVisuales?.length ?? 0}/${MAX_PISTAS_VISUALES})`}
        error={errors.pistasVisuales}
        ayuda="Describe la forma, base, tapa, llave y material que distinguen este modelo de los parecidos. Si los dibujos o diseños pintados no cambian el modelo, dilo."
      >
        <textarea
          rows={4}
          maxLength={MAX_PISTAS_VISUALES}
          className={claseControl}
          {...register('pistasVisuales')}
        />
      </Campo>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-xs font-medium text-tenue">
          Fotos de referencia ({fields.length} de {MAX_FOTOS_REFERENCIA}) · una por color o variante
        </legend>
        {fields.map((field, i) => (
          <div key={field.id} className="flex items-start gap-2">
            <MiniaturaFoto url={fotos[i]?.url} color={fotos[i]?.color} />
            <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_10rem]">
              <div>
                <input
                  className={claseControl}
                  placeholder="https://…"
                  aria-label={`URL de la foto ${i + 1}`}
                  {...register(`fotosReferencia.${i}.url`)}
                />
                {errors.fotosReferencia?.[i]?.url && (
                  <span className="mt-1 block text-xs text-peligro">
                    {errors.fotosReferencia[i].url.message}
                  </span>
                )}
              </div>
              <input
                className={claseControl}
                placeholder="Color o variante"
                aria-label={`Color de la foto ${i + 1}`}
                {...register(`fotosReferencia.${i}.color`)}
              />
            </div>
            <Boton variante="secundario" aria-label="Quitar foto" onClick={() => remove(i)}>
              ✕
            </Boton>
          </div>
        ))}
        {errorFotos && <p className="text-xs text-peligro">{errorFotos}</p>}
        <div className="flex gap-2">
          <Boton
            variante="secundario"
            disabled={lleno}
            onClick={() => append({ url: '', color: '' })}
          >
            Agregar foto
          </Boton>
          <Boton variante="secundario" disabled={lleno} onClick={() => setVerMultimedia(true)}>
            Usar foto de Multimedia
          </Boton>
        </div>
        {verMultimedia && !lleno && (
          <FotosDeMultimedia
            productoId={producto.id}
            urlsUsadas={fotos.map((f) => f.url)}
            alElegir={(foto) => append(foto)}
            alCerrar={() => setVerMultimedia(false)}
          />
        )}
      </fieldset>
    </div>
  );
}
