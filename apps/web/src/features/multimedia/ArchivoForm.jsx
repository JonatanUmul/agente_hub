import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  TIPOS_MULTIMEDIA,
  comoLoVeElBot,
  esquemaCrearArchivo,
  esquemaEditarArchivo,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { SelectorPautas } from '../../components/SelectorPautas.jsx';
import { usePautasResumen } from '../pautas/hooks.js';
import { useProductos } from '../productos/hooks.js';

const vacioANull = (valor) => (valor === '' || valor === null ? null : Number(valor));

// Se valida con el MISMO esquema de shared que usa la API; al editar se agrega la versión.
function esquemaFormulario(archivo) {
  if (!archivo) return esquemaCrearArchivo;
  return z
    .any()
    .transform((d) => ({ ...d, version: archivo.version }))
    .pipe(esquemaEditarArchivo);
}

const valoresIniciales = (a) => ({
  tipo: a?.tipo ?? 'imagen',
  hubspotFileId: a?.hubspotFileId ?? '',
  descripcion: a?.descripcion ?? '',
  productoId: a?.producto?.id ?? null,
  color: a?.color ?? '',
  tema: a?.tema ?? '',
  pautaIds: a?.pautas.map((pa) => pa.id).sort((x, y) => x - y) ?? [],
  orden: a?.orden ?? 100,
  activo: a?.activo ?? true,
});

// Los <select> necesitan sus opciones antes de dibujarse para mostrar el valor actual.
export function ArchivoForm(props) {
  const productos = useProductos();
  const pautas = usePautasResumen();
  if (productos.isPending || pautas.isPending) return <Cargando />;
  if (productos.error || pautas.error)
    return <MensajeError error={productos.error ?? pautas.error} />;
  return <FormularioArchivo {...props} productos={productos.data} pautas={pautas.data} />;
}

function FormularioArchivo({ archivo, productos, pautas, mutacion, alTerminar, alCancelar }) {
  const editando = Boolean(archivo);
  const esquema = useMemo(() => esquemaFormulario(archivo), [archivo]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquema), defaultValues: valoresIniciales(archivo) });

  const [tipo, activo, pautaIds, productoId] = useWatch({
    control,
    name: ['tipo', 'activo', 'pautaIds', 'productoId'],
  });
  const visibilidad = comoLoVeElBot({ tipo, activo, pautaIds });
  // Sugerimos los colores del producto elegido, sin obligar (la base no lo exige).
  const coloresSugeridos = productos.find((p) => p.id === productoId)?.colores ?? [];

  const enviar = (datos) =>
    mutacion.mutate(editando ? { id: archivo.id, ...datos } : datos, { onSuccess: alTerminar });

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      {editando ? (
        <p className="text-sm text-tenue">
          {archivo.tipo} · ID HubSpot {archivo.hubspotFileId}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Tipo" error={errors.tipo}>
            <select className={claseControl} {...register('tipo')}>
              {TIPOS_MULTIMEDIA.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Campo>
          <Campo
            etiqueta="ID de archivo en HubSpot"
            error={errors.hubspotFileId}
            ayuda="No se puede cambiar después"
          >
            <input className={claseControl} {...register('hubspotFileId')} />
          </Campo>
        </div>
      )}
      <Campo etiqueta="Descripción" error={errors.descripcion}>
        <input className={claseControl} {...register('descripcion')} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Producto" error={errors.productoId}>
          <select className={claseControl} {...register('productoId', { setValueAs: vacioANull })}>
            <option value="">Ninguno</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — ItemCode {p.codigo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          etiqueta="Color"
          error={errors.color}
          ayuda={
            coloresSugeridos.length ? `Del producto: ${coloresSugeridos.join(', ')}` : undefined
          }
        >
          <input list="colores-producto" className={claseControl} {...register('color')} />
          <datalist id="colores-producto">
            {coloresSugeridos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Tema" error={errors.tema}>
          <input className={claseControl} {...register('tema')} />
        </Campo>
        <Campo etiqueta="Orden" error={errors.orden} ayuda="Menor = se envía primero">
          <input
            type="number"
            step="1"
            className={claseControl}
            {...register('orden', { valueAsNumber: true })}
          />
        </Campo>
      </div>
      <SelectorPautas control={control} pautas={pautas} error={errors.pautaIds} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('activo')} /> Activo
      </label>

      <p
        className={`rounded-md px-3 py-2 text-sm ${visibilidad.visible ? 'bg-panel-2 text-texto' : 'bg-alerta/10 text-alerta'}`}
      >
        {visibilidad.detalle}
      </p>

      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={mutacion.isPending}>
          {editando ? 'Guardar' : 'Agregar archivo'}
        </Boton>
      </div>
    </form>
  );
}
