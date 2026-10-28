import { useFieldArray } from 'react-hook-form';
import { MAX_CARACTERISTICAS } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseControl } from '../../components/Campo.jsx';

// Lista editable de características (campo `caracteristicas`: [{ texto }], porque useFieldArray necesita
// objetos). El orden de la lista es el orden en que el bot las dirá.
// `contradicciones`: avisos de contradiccionesFicha(), por índice; no impiden guardar.
export function ListaCaracteristicas({ control, register, errors, contradicciones }) {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'caracteristicas' });
  const errorDeLista = errors?.message ?? errors?.root?.message;

  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-tenue">
        Características ({fields.length} de {MAX_CARACTERISTICAS})
      </legend>
      <ol className="space-y-2">
        {fields.map((field, i) => {
          const error = errors?.[i]?.message ?? errors?.[i]?.texto?.message;
          const avisos = contradicciones.filter((c) => c.indice === i);
          return (
            <li key={field.id}>
              <div className="flex items-center gap-1">
                <span className="w-5 text-right text-xs text-apagado">{i + 1}.</span>
                <input
                  className={claseControl}
                  aria-label={`Característica ${i + 1}`}
                  {...register(`caracteristicas.${i}.texto`)}
                />
                <Boton
                  variante="secundario"
                  aria-label="Subir"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </Boton>
                <Boton
                  variante="secundario"
                  aria-label="Bajar"
                  disabled={i === fields.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </Boton>
                <Boton variante="peligro" aria-label="Quitar" onClick={() => remove(i)}>
                  ✕
                </Boton>
              </div>
              {error && <p className="mt-1 ml-6 text-xs text-peligro">{error}</p>}
              {avisos.map((a) => (
                <p key={a.motivo} className="mt-1 ml-6 text-xs text-alerta">
                  ⚠ Posible contradicción: {a.motivo}
                </p>
              ))}
            </li>
          );
        })}
      </ol>
      {errorDeLista && <p className="mt-1 text-xs text-peligro">{errorDeLista}</p>}
      <Boton
        variante="secundario"
        className="mt-2"
        disabled={fields.length >= MAX_CARACTERISTICAS}
        onClick={() => append({ texto: '' })}
      >
        Agregar característica
      </Boton>
    </fieldset>
  );
}
