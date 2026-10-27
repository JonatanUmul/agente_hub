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
import { MensajeError } from '../../components/MensajeError.jsx';
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
  pautaId: a?.pauta?.id ?? null,
  orden: a?.orden ?? 100,
  activo: a?.activo ?? true,
});

export function ArchivoForm({ archivo, mutacion, alTerminar, alCancelar }) {
  const editando = Boolean(archivo);
  const { data: productos = [] } = useProductos();
  const { data: pautas = [] } = usePautasResumen();
  const esquema = useMemo(() => esquemaFormulario(archivo), [archivo]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquema), defaultValues: valoresIniciales(archivo) });

  const [tipo, activo, pautaId, productoId] = useWatch({
    control,
    name: ['tipo', 'activo', 'pautaId', 'productoId'],
  });
  const visibilidad = comoLoVeElBot({ tipo, activo, pautaId });
  // Sugerimos los colores del producto elegido, sin obligar (la base no lo exige).
  const coloresSugeridos = productos.find((p) => p.id === productoId)?.colores ?? [];

  const enviar = (datos) =>
    mutacion.mutate(editando ? { id: archivo.id, ...datos } : datos, { onSuccess: alTerminar });

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      {editando ? (
        <p className="text-sm text-slate-600">
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
      <Campo
        etiqueta="Descripción"
        error={errors.descripcion}
        ayuda="El bot la usa para elegir qué archivo enviar"
      >
        <input className={claseControl} {...register('descripcion')} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Producto" error={errors.productoId}>
          <select className={claseControl} {...register('productoId', { setValueAs: vacioANull })}>
            <option value="">Ninguno</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.codigo})
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
      <Campo etiqueta="Pauta" error={errors.pautaId}>
        <select className={claseControl} {...register('pautaId', { setValueAs: vacioANull })}>
          <option value="">Ninguna</option>
          {pautas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {!p.vigente && ' — no vigente'}
            </option>
          ))}
        </select>
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('activo')} /> Activo
      </label>

      <p
        className={`rounded-md px-3 py-2 text-sm ${visibilidad.visible ? 'bg-slate-50 text-slate-700' : 'bg-amber-50 text-amber-800'}`}
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
