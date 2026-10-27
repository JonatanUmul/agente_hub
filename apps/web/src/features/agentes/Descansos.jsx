import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { esquemaCrearDescanso } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { fechaCorta } from './formato.js';

// Fechas en que el agente no atiende aunque su horario semanal diga lo contrario.
export function Descansos({ agente, agregar, quitar, puedeEditar }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaCrearDescanso),
    defaultValues: { desde: '', hasta: '', motivo: '' },
  });

  const enviar = (datos) =>
    agregar.mutate({ id: agente.id, ...datos }, { onSuccess: () => reset() });

  return (
    <div className="space-y-3">
      {agente.descansos.length === 0 ? (
        <p className="text-sm text-apagado">Sin días de descanso programados.</p>
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {agente.descansos.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-mono text-xs">
                {d.desde === d.hasta
                  ? fechaCorta(d.desde)
                  : `${fechaCorta(d.desde)} → ${fechaCorta(d.hasta)}`}
              </span>
              <span className="flex-1 text-tenue">{d.motivo ?? '—'}</span>
              {puedeEditar && (
                <Boton
                  variante="enlace"
                  className="text-xs"
                  onClick={() => quitar.mutate({ id: agente.id, descansoId: d.id })}
                  disabled={quitar.isPending}
                >
                  Quitar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
      <MensajeError error={quitar.error} />

      {puedeEditar && (
        <form
          onSubmit={handleSubmit(enviar)}
          className="grid grid-cols-[1fr_1fr_2fr_auto] items-end gap-2"
          noValidate
        >
          <Campo etiqueta="Desde" error={errors.desde}>
            <input type="date" className={claseControl} {...register('desde')} />
          </Campo>
          <Campo etiqueta="Hasta" error={errors.hasta}>
            <input type="date" className={claseControl} {...register('hasta')} />
          </Campo>
          <Campo etiqueta="Motivo (opcional)" error={errors.motivo}>
            <input
              className={claseControl}
              placeholder="Vacaciones, día libre…"
              {...register('motivo')}
            />
          </Campo>
          <Boton type="submit" cargando={agregar.isPending} className="mb-px">
            Agregar
          </Boton>
        </form>
      )}
      <MensajeError error={agregar.error} />
    </div>
  );
}
