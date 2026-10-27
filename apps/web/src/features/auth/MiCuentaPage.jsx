import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { esquemaCambiarContrasena } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { useCambiarContrasena, useSesion } from './hooks.js';

// La confirmación solo existe en el formulario: la API no la necesita.
const esquemaFormulario = esquemaCambiarContrasena
  .extend({ confirmacion: z.string() })
  .refine((d) => d.nueva === d.confirmacion, {
    path: ['confirmacion'],
    message: 'No coincide con la nueva contraseña',
  });

export function MiCuentaPage() {
  const { data: sesion } = useSesion();
  const cambiar = useCambiarContrasena();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaFormulario) });

  const enviar = ({ actual, nueva }) =>
    cambiar.mutate({ actual, nueva }, { onSuccess: () => reset() });

  return (
    <section className="max-w-md space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mi cuenta</h2>
        <p className="text-sm text-slate-600">
          {sesion.usuario.nombre} · {sesion.usuario.correo} · rol {sesion.usuario.rol}
        </p>
      </div>
      <form
        onSubmit={handleSubmit(enviar)}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
        noValidate
      >
        <h3 className="font-medium">Cambiar contraseña</h3>
        <Campo etiqueta="Contraseña actual" error={errors.actual}>
          <input
            type="password"
            autoComplete="current-password"
            className={claseControl}
            {...register('actual')}
          />
        </Campo>
        <Campo etiqueta="Nueva contraseña" error={errors.nueva} ayuda="Mínimo 12 caracteres">
          <input
            type="password"
            autoComplete="new-password"
            className={claseControl}
            {...register('nueva')}
          />
        </Campo>
        <Campo etiqueta="Repite la nueva contraseña" error={errors.confirmacion}>
          <input
            type="password"
            autoComplete="new-password"
            className={claseControl}
            {...register('confirmacion')}
          />
        </Campo>
        <MensajeError error={cambiar.error} />
        {cambiar.isSuccess && (
          <p className="text-sm text-emerald-700">
            Contraseña actualizada. Se cerraron tus sesiones en otros navegadores.
          </p>
        )}
        <Boton type="submit" cargando={cambiar.isPending}>
          Cambiar contraseña
        </Boton>
      </form>
    </section>
  );
}
