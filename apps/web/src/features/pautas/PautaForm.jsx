import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PARAMETROS_ENTEROS, esquemaCrearPauta, esquemaEditarPauta } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { fecha, porcentaje } from '../../lib/formato.js';
import { isoALocal, localAIso } from '../../lib/fechas.js';
import { useParametros } from '../configuracion/hooks.js';
import { useArchivos } from '../multimedia/hooks.js';
import { useProductos } from '../productos/hooks.js';
import { PautaModelos } from './PautaModelos.jsx';
import { PautaMultimedia } from './PautaMultimedia.jsx';

// El formulario trabaja con texto (palabras separadas por comas, fechas en hora local).
// Se convierte al formato de la API y se valida con el MISMO esquema de shared que usa la API.
const desdeFormulario = (d) => ({
  ...d,
  palabrasClave: d.palabrasClave.split(','),
  vigenteDesde: localAIso(d.vigenteDesde),
  vigenteHasta: localAIso(d.vigenteHasta),
});

function esquemaFormulario(pauta) {
  if (!pauta) return z.any().transform(desdeFormulario).pipe(esquemaCrearPauta);
  return z
    .any()
    .transform((d) => ({ ...desdeFormulario(d), version: pauta.version }))
    .pipe(esquemaEditarPauta);
}

const vacioANull = (valor) => (valor === '' || valor === null ? null : Number(valor));

const valoresIniciales = (p) => ({
  codigo: p?.codigo ?? '',
  nombre: p?.nombre ?? '',
  mensajeCliente: p?.mensajeCliente ?? '',
  descuentoPct: p?.descuentoPct ?? null,
  palabrasClave: p?.palabrasClave.join(', ') ?? '',
  vigenteDesde: isoALocal(p?.vigenteDesde),
  vigenteHasta: isoALocal(p?.vigenteHasta),
  activo: p?.activo ?? true,
  aplicaTodos: p?.aplicaTodos ?? false,
  productoIds: p?.productoIds ?? [],
  multimediaIds: p?.multimediaIds ?? [],
});

const cantidad = (ids) => `${ids.length}`;

// Qué cambios afectan lo que el bot dice hoy (si la pauta está vigente o lo estará con el cambio).
function cambiosSensibles(antes, despues) {
  const cambios = [];
  if (antes.descuentoPct !== despues.descuentoPct)
    cambios.push(['Descuento', porcentaje(antes.descuentoPct), porcentaje(despues.descuentoPct)]);
  if (Date.parse(antes.vigenteDesde ?? 0) !== Date.parse(despues.vigenteDesde ?? 0))
    cambios.push(['Vigente desde', fecha(antes.vigenteDesde), fecha(despues.vigenteDesde)]);
  if (Date.parse(antes.vigenteHasta ?? 0) !== Date.parse(despues.vigenteHasta ?? 0))
    cambios.push(['Vigente hasta', fecha(antes.vigenteHasta), fecha(despues.vigenteHasta)]);
  if (antes.activo !== despues.activo)
    cambios.push(['Activa', antes.activo ? 'Sí' : 'No', despues.activo ? 'Sí' : 'No']);
  if (antes.aplicaTodos !== despues.aplicaTodos)
    cambios.push([
      'Todos los modelos',
      antes.aplicaTodos ? 'Sí' : 'No',
      despues.aplicaTodos ? 'Sí' : 'No',
    ]);
  if (!despues.aplicaTodos && antes.productoIds.join() !== despues.productoIds.join())
    cambios.push(['Modelos', cantidad(antes.productoIds), cantidad(despues.productoIds)]);
  if (antes.multimediaIds.join() !== despues.multimediaIds.join())
    cambios.push(['Archivos', cantidad(antes.multimediaIds), cantidad(despues.multimediaIds)]);
  return cambios;
}

// Un arte agregado en «Imagen de la pauta» llega asociado desde el servidor: lo sumamos a la selección
// para que guardar el formulario no lo quite.
function useArchivosNuevosDelServidor(idsServidor, getValues, setValue) {
  const anteriores = useRef(idsServidor);
  useEffect(() => {
    if (!idsServidor || idsServidor === anteriores.current) return;
    const nuevos = idsServidor.filter((id) => !(anteriores.current ?? []).includes(id));
    anteriores.current = idsServidor;
    if (nuevos.length) {
      const actuales = getValues('multimediaIds');
      setValue(
        'multimediaIds',
        [...new Set([...actuales, ...nuevos])].sort((a, b) => a - b),
      );
    }
  }, [idsServidor, getValues, setValue]);
}

// `multimediaIdsServidor`: archivos de la pauta según la lista recién recargada (la pauta del formulario es la
// que se abrió, con su versión, para no pisar cambios de otra persona).
export function PautaForm({ pauta, multimediaIdsServidor, mutacion, alTerminar, alCancelar }) {
  const editando = Boolean(pauta);
  const [porConfirmar, setPorConfirmar] = useState(null);
  const esquema = useMemo(() => esquemaFormulario(pauta), [pauta]);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales(pauta),
  });
  const { data: productos = [] } = useProductos();
  const { data: archivos = [] } = useArchivos();
  const { data: parametros } = useParametros();
  const maxFotos =
    parametros?.find((p) => p.clave === 'max_fotos_pauta')?.valor ??
    PARAMETROS_ENTEROS.max_fotos_pauta.porDefecto;
  useArchivosNuevosDelServidor(multimediaIdsServidor, getValues, setValue);
  const [productoIds, aplicaTodos, mensajeCliente, nombre] = useWatch({
    control,
    name: ['productoIds', 'aplicaTodos', 'mensajeCliente', 'nombre'],
  });

  const guardar = (datos) =>
    mutacion.mutate(editando ? { id: pauta.id, ...datos } : datos, { onSuccess: alTerminar });

  const enviar = (datos) => {
    const cambios = editando ? cambiosSensibles(pauta, datos) : [];
    if (cambios.length > 0) setPorConfirmar({ datos, cambios });
    else guardar(datos);
  };

  if (porConfirmar) {
    return (
      <div className="space-y-4 text-sm">
        <p>Estos cambios aplican en el siguiente mensaje de cada cliente:</p>
        <table className="w-full">
          <tbody>
            {porConfirmar.cambios.map(([campo, antes, despues]) => (
              <tr key={campo} className="border-b border-borde">
                <td className="py-1 font-medium">{campo}</td>
                <td className="py-1 text-tenue line-through">{antes}</td>
                <td className="py-1">{despues}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <MensajeError error={mutacion.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setPorConfirmar(null)}>
            Volver
          </Boton>
          <Boton cargando={mutacion.isPending} onClick={() => guardar(porConfirmar.datos)}>
            Confirmar y guardar
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      {editando ? (
        <p className="text-sm text-tenue">Código: {pauta.codigo}</p>
      ) : (
        <Campo etiqueta="Código" error={errors.codigo} ayuda="No se puede cambiar después">
          <input className={claseControl} {...register('codigo')} />
        </Campo>
      )}
      <Campo etiqueta="Nombre" error={errors.nombre}>
        <input className={claseControl} {...register('nombre')} />
      </Campo>
      <Campo etiqueta="Mensaje para el cliente" error={errors.mensajeCliente}>
        <textarea rows={3} className={claseControl} {...register('mensajeCliente')} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo
          etiqueta="Descuento (%)"
          error={errors.descuentoPct}
          ayuda="Vacío = sin descuento propio de la pauta"
        >
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className={claseControl}
            {...register('descuentoPct', { setValueAs: vacioANull })}
          />
        </Campo>
        <Campo etiqueta="Palabras clave" error={errors.palabrasClave} ayuda="Separadas por comas">
          <input className={claseControl} {...register('palabrasClave')} />
        </Campo>
        <Campo etiqueta="Vigente desde" error={errors.vigenteDesde} ayuda="Vacío = desde ya">
          <input type="datetime-local" className={claseControl} {...register('vigenteDesde')} />
        </Campo>
        <Campo
          etiqueta="Vigente hasta"
          error={errors.vigenteHasta}
          ayuda="Vacío = sin fecha de fin"
        >
          <input type="datetime-local" className={claseControl} {...register('vigenteHasta')} />
        </Campo>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('activo')} /> Activa
      </label>
      <PautaModelos control={control} productos={productos} pautaId={pauta?.id} />
      <PautaMultimedia
        control={control}
        archivos={archivos}
        // Al crear todavía no hay id: 0 no corresponde a ninguna pauta real.
        pautaId={pauta?.id ?? 0}
        productoIds={productoIds}
        aplicaTodos={aplicaTodos}
        maxFotos={maxFotos}
        mensaje={mensajeCliente || nombre}
      />
      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={mutacion.isPending}>
          {editando ? 'Guardar' : 'Crear pauta'}
        </Boton>
      </div>
    </form>
  );
}
