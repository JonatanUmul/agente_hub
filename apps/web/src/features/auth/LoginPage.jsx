import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation } from 'react-router-dom';
import { esquemaLogin } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { BotonTema } from '../../components/BotonTema.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { Logo } from '../../components/Logo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { useIniciarSesion, useSesion } from './hooks.js';

export function LoginPage() {
  const { data: sesion } = useSesion();
  const ubicacion = useLocation();
  const login = useIniciarSesion();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquemaLogin) });

  if (sesion) return <Navigate to={ubicacion.state?.desde ?? '/'} replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <BotonTema className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <form
          onSubmit={handleSubmit((datos) => login.mutate(datos))}
          className="space-y-4 rounded-lg border border-borde bg-panel p-6"
          noValidate
        >
          <div>
            <h1 className="text-lg font-medium">Iniciar sesión</h1>
            <p className="text-sm text-tenue">
              Administra lo que el bot de WhatsApp le dice a los clientes.
            </p>
          </div>
          <Campo etiqueta="Correo" error={errors.correo}>
            <input
              type="email"
              autoComplete="username"
              className={claseControl}
              {...register('correo')}
            />
          </Campo>
          <Campo etiqueta="Contraseña" error={errors.contrasena}>
            <input
              type="password"
              autoComplete="current-password"
              className={claseControl}
              {...register('contrasena')}
            />
          </Campo>
          <MensajeError error={login.error} />
          <Boton type="submit" cargando={login.isPending} className="h-9 w-full">
            Entrar
          </Boton>
        </form>
      </div>
    </div>
  );
}
