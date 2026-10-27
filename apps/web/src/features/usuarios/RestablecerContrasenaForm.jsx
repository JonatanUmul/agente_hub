import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { esquemaRestablecerContrasena } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';

export function RestablecerContrasenaForm({ usuario, mutacion, alTerminar, alCancelar }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaRestablecerContrasena) });

  const enviar = ({ contrasena }) =>
    mutacion.mutate({ id: usuario.id, contrasena }, { onSuccess: alTerminar });

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      <p className="text-sm text-slate-700">
        Nueva contraseña para <strong>{usuario.correo}</strong>. Se desbloqueará la cuenta y se
        cerrarán todas sus sesiones.
      </p>
      <Campo etiqueta="Nueva contraseña" error={errors.contrasena} ayuda="Mínimo 12 caracteres">
        <input
          type="password"
          autoComplete="new-password"
          className={claseControl}
          {...register('contrasena')}
        />
      </Campo>
      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={mutacion.isPending}>
          Restablecer
        </Boton>
      </div>
    </form>
  );
}
