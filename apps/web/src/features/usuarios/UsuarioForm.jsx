import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROLES, esquemaCrearUsuario } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';

const DESCRIPCION_ROL = {
  admin: 'Todo, incluye usuarios',
  comercial: 'Productos, precios, pautas, interruptores, multimedia',
  contenido: 'Reglas del bot y preguntas frecuentes',
  lectura: 'Solo ver',
};

// Al editar no se cambian ni el correo ni la contraseña (esta tiene su propia acción).
const esquemaEdicion = esquemaCrearUsuario.pick({ nombre: true, rol: true });

export function UsuarioForm({ usuario, mutacion, alTerminar, alCancelar }) {
  const editando = Boolean(usuario);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editando ? esquemaEdicion : esquemaCrearUsuario),
    defaultValues: editando ? { nombre: usuario.nombre, rol: usuario.rol } : { rol: 'lectura' },
  });

  const enviar = (datos) =>
    mutacion.mutate(editando ? { id: usuario.id, ...datos } : datos, { onSuccess: alTerminar });

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      {!editando && (
        <Campo etiqueta="Correo" error={errors.correo}>
          <input type="email" autoComplete="off" className={claseControl} {...register('correo')} />
        </Campo>
      )}
      <Campo etiqueta="Nombre" error={errors.nombre}>
        <input className={claseControl} {...register('nombre')} />
      </Campo>
      <Campo etiqueta="Rol" error={errors.rol}>
        <select className={claseControl} {...register('rol')}>
          {ROLES.map((rol) => (
            <option key={rol} value={rol}>
              {rol} — {DESCRIPCION_ROL[rol]}
            </option>
          ))}
        </select>
      </Campo>
      {!editando && (
        <Campo etiqueta="Contraseña inicial" error={errors.contrasena} ayuda="Mínimo 12 caracteres">
          <input
            type="password"
            autoComplete="new-password"
            className={claseControl}
            {...register('contrasena')}
          />
        </Campo>
      )}
      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={mutacion.isPending}>
          {editando ? 'Guardar' : 'Crear usuario'}
        </Boton>
      </div>
    </form>
  );
}
