import { useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  EMOJIS_FRASE,
  INFO_SITUACIONES,
  MAX_FRASE,
  MODULOS_FRASE,
  NOMBRES_MODULO_FRASE,
  SITUACIONES_FRASE,
  esquemaCrearFrase,
  esquemaEditarFrase,
  largoFrase,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { VistaPreviaWhatsapp } from './VistaPreviaWhatsapp.jsx';

// Se valida con el MISMO esquema de shared que usa la API.
const esquemaFormulario = (frase) =>
  frase
    ? z
        .any()
        .transform((d) => ({ ...d, version: frase.version }))
        .pipe(esquemaEditarFrase)
    : esquemaCrearFrase;

// `inicial`: módulo y situación sugeridos al agregar desde un grupo.
export function FraseForm({ frase, inicial, mutacion, alTerminar, alCancelar }) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaFormulario(frase)),
    defaultValues: {
      modulo: frase?.modulo ?? inicial?.modulo ?? 'GLOBAL',
      situacion: frase?.situacion ?? inicial?.situacion ?? 'general',
      frase: frase?.frase ?? '',
      activo: frase?.activo ?? true,
    },
  });
  const [texto, situacion] = useWatch({ control, name: ['frase', 'situacion'] });
  const campoFrase = register('frase');
  const entrada = useRef(null);

  // Inserta el emoji donde está el cursor (o al final) y deja el cursor después del emoji.
  const insertarEmoji = (emoji) => {
    const el = entrada.current;
    const inicio = el?.selectionStart ?? texto.length;
    const fin = el?.selectionEnd ?? texto.length;
    const nuevo = `${texto.slice(0, inicio)}${emoji}${texto.slice(fin)}`;
    setValue('frase', nuevo, { shouldDirty: true, shouldValidate: Boolean(errors.frase) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(inicio + emoji.length, inicio + emoji.length);
    });
  };

  const guardar = (datos) =>
    mutacion.mutate(frase ? { id: frase.id, ...datos } : datos, { onSuccess: alTerminar });
  const largo = largoFrase((texto ?? '').trim());

  return (
    <form onSubmit={handleSubmit(guardar)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Módulo" error={errors.modulo}>
          <select className={claseControl} {...register('modulo')}>
            {MODULOS_FRASE.map((m) => (
              <option key={m} value={m}>
                {NOMBRES_MODULO_FRASE[m]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          etiqueta="Situación"
          error={errors.situacion}
          ayuda={INFO_SITUACIONES[situacion]?.cuando}
        >
          <select className={claseControl} {...register('situacion')}>
            {SITUACIONES_FRASE.map((s) => (
              <option key={s} value={s}>
                {INFO_SITUACIONES[s].titulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div>
        <Campo etiqueta="Frase" error={errors.frase}>
          <input
            className={claseControl}
            placeholder="¿Te ayudo con algo más? 💧"
            {...campoFrase}
            ref={(el) => {
              campoFrase.ref(el);
              entrada.current = el;
            }}
          />
        </Campo>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1" aria-label="Insertar emoji">
            {EMOJIS_FRASE.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => insertarEmoji(e)}
                className="rounded px-1.5 py-0.5 text-base hover:bg-panel-2"
                aria-label={`Insertar ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
          <span className={`text-xs ${largo > MAX_FRASE ? 'text-peligro' : 'text-apagado'}`}>
            {largo}/{MAX_FRASE}
          </span>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('activo')} /> Activa (el bot puede elegirla)
      </label>

      <VistaPreviaWhatsapp situacion={situacion} frase={(texto ?? '').trim()} />

      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={mutacion.isPending}>
          {frase ? 'Guardar' : 'Agregar'}
        </Boton>
      </div>
    </form>
  );
}
