import { useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  COMODIN_MOMENTO,
  EMOJIS_SALUDO,
  MAX_SALUDO,
  MODULOS_SALUDO,
  NOMBRES_MODULO_SALUDO,
  PRIORIDAD_TEMPORADA,
  ahoraEnGuatemala,
  choquesDeSaludo,
  esquemaCrearSaludo,
  esquemaEditarSaludo,
  resolverSaludo,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { GloboWhatsapp } from '../../components/GloboWhatsapp.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';

// «Siempre» guarda las fechas vacías; el resto se valida con el mismo esquema que la API.
const desdeFormulario = (d) => ({
  nombre: d.nombre,
  modulo: d.modulo,
  saludo: d.saludo,
  fechaInicio: d.temporada ? d.fechaInicio || null : null,
  fechaFin: d.temporada ? d.fechaFin || null : null,
  repetirAnual: d.temporada ? d.repetirAnual : false,
  prioridad: d.prioridad,
  activo: d.activo,
});
const esquemaFormulario = (saludo) =>
  z
    .any()
    .transform((d) =>
      saludo ? { ...desdeFormulario(d), version: saludo.version } : desdeFormulario(d),
    )
    .pipe(saludo ? esquemaEditarSaludo : esquemaCrearSaludo);

export function SaludoForm({ saludo, saludos, mutacion, alTerminar, alCancelar }) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaFormulario(saludo)),
    defaultValues: {
      nombre: saludo?.nombre ?? '',
      modulo: saludo?.modulo ?? 'GLOBAL',
      saludo: saludo?.saludo ?? '',
      temporada: Boolean(saludo?.fechaInicio),
      fechaInicio: saludo?.fechaInicio ?? '',
      fechaFin: saludo?.fechaFin ?? '',
      repetirAnual: saludo?.repetirAnual ?? true,
      prioridad: saludo?.prioridad ?? 0,
      activo: saludo?.activo ?? true,
    },
  });
  const valores = useWatch({ control });
  const campoSaludo = register('saludo');
  const entrada = useRef(null);
  const { fecha, hora } = ahoraEnGuatemala();

  const insertar = (texto) => {
    const el = entrada.current;
    const actual = valores.saludo ?? '';
    const inicio = el?.selectionStart ?? actual.length;
    const fin = el?.selectionEnd ?? actual.length;
    setValue('saludo', `${actual.slice(0, inicio)}${texto}${actual.slice(fin)}`, {
      shouldDirty: true,
      shouldValidate: Boolean(errors.saludo),
    });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(inicio + texto.length, inicio + texto.length);
    });
  };

  const datos = desdeFormulario(valores);
  const choques = choquesDeSaludo({ ...datos, id: saludo?.id }, saludos, fecha);
  const largo = [...(valores.saludo ?? '').trim()].length;
  const guardar = (d) =>
    mutacion.mutate(saludo ? { id: saludo.id, ...d } : d, { onSuccess: alTerminar });

  return (
    <form onSubmit={handleSubmit(guardar)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Nombre" error={errors.nombre}>
          <input className={claseControl} placeholder="Navidad" {...register('nombre')} />
        </Campo>
        <Campo etiqueta="Módulo" error={errors.modulo}>
          <select className={claseControl} {...register('modulo')}>
            {MODULOS_SALUDO.map((m) => (
              <option key={m} value={m}>
                {NOMBRES_MODULO_SALUDO[m]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div>
        <Campo etiqueta="Saludo" error={errors.saludo}>
          <textarea
            rows={2}
            className={claseControl}
            placeholder="¡{momento}! 😊 Soy Eco, asistente de Ecofiltro Guatemala."
            {...campoSaludo}
            ref={(el) => {
              campoSaludo.ref(el);
              entrada.current = el;
            }}
          />
        </Campo>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => insertar(COMODIN_MOMENTO)}
              className="rounded border border-borde-fuerte px-1.5 py-0.5 font-mono text-xs hover:bg-panel-2"
            >
              {COMODIN_MOMENTO}
            </button>
            {EMOJIS_SALUDO.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => insertar(e)}
                className="rounded px-1.5 py-0.5 text-base hover:bg-panel-2"
                aria-label={`Insertar ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
          <span className={`text-xs ${largo > MAX_SALUDO ? 'text-peligro' : 'text-apagado'}`}>
            {largo}/{MAX_SALUDO}
          </span>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-panel-2 p-1 text-sm" role="group">
        {[
          [false, 'Siempre'],
          [true, 'Temporada'],
        ].map(([temporada, texto]) => (
          <button
            key={texto}
            type="button"
            aria-pressed={valores.temporada === temporada}
            onClick={() => setValue('temporada', temporada)}
            className={`flex-1 rounded-md px-3 py-1 ${valores.temporada === temporada ? 'bg-panel font-medium shadow-sm' : 'text-tenue'}`}
          >
            {texto}
          </button>
        ))}
      </div>
      {valores.temporada && (
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Inicio" error={errors.fechaInicio}>
            <input type="date" className={claseControl} {...register('fechaInicio')} />
          </Campo>
          <Campo etiqueta="Fin" error={errors.fechaFin}>
            <input type="date" className={claseControl} {...register('fechaFin')} />
          </Campo>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('repetirAnual')} /> Se repite cada año
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Campo
          etiqueta="Prioridad"
          error={errors.prioridad}
          ayuda={`Las temporadas usan ${PRIORIDAD_TEMPORADA} para ganarle al saludo normal`}
        >
          <input
            type="number"
            step="1"
            className={claseControl}
            {...register('prioridad', { valueAsNumber: true })}
          />
        </Campo>
        <label className="flex items-center gap-2 self-center text-sm">
          <input type="checkbox" {...register('activo')} /> Activo
        </label>
      </div>

      {choques.length > 0 && (
        <p className="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm">
          Coincide en fechas con {choques.map((c) => `«${c.nombre}»`).join(', ')} (mismo módulo y
          prioridad): el bot elegirá uno al azar.
        </p>
      )}

      <GloboWhatsapp>{resolverSaludo((valores.saludo ?? '').trim() || '…', hora)}</GloboWhatsapp>

      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={mutacion.isPending}>
          {saludo ? 'Guardar' : 'Agregar'}
        </Boton>
      </div>
    </form>
  );
}
