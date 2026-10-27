import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MODULOS, esquemaCrearPregunta, esquemaEditarPregunta } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { useSiguienteNumero } from './hooks.js';

// Palabras clave como texto separado por comas; se validan con el MISMO esquema de shared que usa la API.
const desdeFormulario = (d) => ({ ...d, palabrasClave: d.palabrasClave.split(',') });
function esquemaFormulario(pregunta) {
  if (!pregunta) return z.any().transform(desdeFormulario).pipe(esquemaCrearPregunta);
  return z
    .any()
    .transform((d) => ({ ...desdeFormulario(d), version: pregunta.version }))
    .pipe(esquemaEditarPregunta);
}

const valoresIniciales = (p, numeroSugerido) => ({
  numero: p?.numero ?? numeroSugerido,
  pregunta: p?.pregunta ?? '',
  tema: p?.tema ?? '',
  palabrasClave: p?.palabrasClave.join(', ') ?? '',
  respuesta: p?.respuesta ?? '',
  modulos: p?.modulos ?? ['GLOBAL'],
  orden: p?.orden ?? 100,
  activo: p?.activo ?? true,
});

// Al crear, espera el número sugerido para usarlo como valor inicial del campo.
export function PreguntaForm(props) {
  const creando = !props.pregunta;
  const siguiente = useSiguienteNumero(creando);
  if (creando && siguiente.isPending) return <Cargando />;
  return <FormularioPregunta {...props} numeroSugerido={siguiente.data?.numero ?? ''} />;
}

function FormularioPregunta({ pregunta, numeroSugerido, mutacion, alTerminar, alCancelar }) {
  const editando = Boolean(pregunta);
  const esquema = useMemo(() => esquemaFormulario(pregunta), [pregunta]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales(pregunta, numeroSugerido),
  });

  const enviar = (datos) =>
    mutacion.mutate(editando ? { id: pregunta.id, ...datos } : datos, { onSuccess: alTerminar });

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      <div className="grid grid-cols-3 gap-4">
        {editando ? (
          <p className="text-sm text-slate-600">Número: {pregunta.numero}</p>
        ) : (
          <Campo etiqueta="Número" error={errors.numero} ayuda="No se puede cambiar después">
            <input
              type="number"
              step="1"
              min="1"
              className={claseControl}
              {...register('numero', { valueAsNumber: true })}
            />
          </Campo>
        )}
        <Campo etiqueta="Tema" error={errors.tema}>
          <input className={claseControl} {...register('tema')} />
        </Campo>
        <Campo etiqueta="Orden" error={errors.orden} ayuda="Menor = primero">
          <input
            type="number"
            step="1"
            className={claseControl}
            {...register('orden', { valueAsNumber: true })}
          />
        </Campo>
      </div>
      <Campo etiqueta="Pregunta" error={errors.pregunta}>
        <input className={claseControl} {...register('pregunta')} />
      </Campo>
      <Campo
        etiqueta="Respuesta"
        error={errors.respuesta}
        ayuda="Texto que usa el bot para responder"
      >
        <textarea rows={6} className={claseControl} {...register('respuesta')} />
      </Campo>
      <Campo etiqueta="Palabras clave" error={errors.palabrasClave} ayuda="Separadas por comas">
        <input className={claseControl} {...register('palabrasClave')} />
      </Campo>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Módulos</legend>
        <div className="flex flex-wrap gap-4">
          {MODULOS.map((m) => (
            <label key={m} className="flex items-center gap-1 text-sm">
              <input type="checkbox" value={m} {...register('modulos')} /> {m}
            </label>
          ))}
        </div>
        {errors.modulos && <p className="mt-1 text-xs text-red-700">{errors.modulos.message}</p>}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('activo')} /> Activa
      </label>
      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={mutacion.isPending}>
          {editando ? 'Guardar' : 'Crear pregunta'}
        </Boton>
      </div>
    </form>
  );
}
