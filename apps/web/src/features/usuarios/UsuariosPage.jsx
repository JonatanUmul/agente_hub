import { useState } from 'react';
import { ConPermiso } from '../../app/RutaProtegida.jsx';
import { Boton } from '../../components/Boton.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Pestanas } from '../../components/Pestanas.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { usePermiso, useSesion } from '../auth/hooks.js';
import { ControlAccesos } from './ControlAccesos.jsx';
import { RestablecerContrasenaForm } from './RestablecerContrasenaForm.jsx';
import { UsuarioForm } from './UsuarioForm.jsx';
import {
  useCerrarSesiones,
  useCrearUsuario,
  useEditarUsuario,
  useRestablecerContrasena,
  useUsuarios,
} from './hooks.js';

const formatoFecha = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
const fecha = (iso) => (iso ? formatoFecha.format(new Date(iso)) : '—');
const estaBloqueado = (u) => u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date();

const PESTANAS = [
  { id: 'usuarios', titulo: 'Usuarios' },
  { id: 'accesos', titulo: 'Control de accesos' },
];

export function UsuariosPage() {
  return (
    <ConPermiso permitido={usePermiso('usuarios:gestionar')}>
      <Usuarios />
    </ConPermiso>
  );
}

function Usuarios() {
  const { data: usuarios, isPending, error } = useUsuarios();
  const { data: sesion } = useSesion();
  const crear = useCrearUsuario();
  const editar = useEditarUsuario();
  const restablecer = useRestablecerContrasena();
  const cerrarSesiones = useCerrarSesiones();
  const [pestana, setPestana] = useState('usuarios');

  // Un solo estado para saber qué modal está abierto y sobre qué usuario.
  // { tipo: 'crear'|'editar'|'activo'|'contrasena'|'sesiones', usuario? }
  const [accion, setAccion] = useState(null);
  const cerrar = () => {
    setAccion(null);
    crear.reset();
    editar.reset();
    restablecer.reset();
    cerrarSesiones.reset();
  };

  if (isPending) return <p className="text-tenue">Cargando usuarios…</p>;
  if (error) return <MensajeError error={error} />;

  const columnas = [
    { titulo: 'Nombre', celda: (u) => u.nombre },
    { titulo: 'Correo', celda: (u) => u.correo },
    { titulo: 'Rol', celda: (u) => u.rol },
    {
      titulo: 'Estado',
      celda: (u) =>
        !u.activo ? (
          <span className="text-tenue">Inactivo</span>
        ) : estaBloqueado(u) ? (
          <span className="text-alerta">Bloqueado hasta {fecha(u.bloqueadoHasta)}</span>
        ) : (
          <span className="text-acento">Activo</span>
        ),
    },
    { titulo: 'Último acceso', celda: (u) => fecha(u.ultimoAcceso) },
    {
      titulo: 'Acciones',
      className: 'text-right whitespace-nowrap',
      celda: (u) => (
        <div className="flex justify-end gap-3">
          <Boton variante="enlace" onClick={() => setAccion({ tipo: 'editar', usuario: u })}>
            Editar
          </Boton>
          <Boton variante="enlace" onClick={() => setAccion({ tipo: 'contrasena', usuario: u })}>
            Contraseña
          </Boton>
          {u.id !== sesion.usuario.id && (
            <>
              {u.activo && (
                <Boton
                  variante="enlace"
                  onClick={() => setAccion({ tipo: 'sesiones', usuario: u })}
                >
                  Cerrar sesiones
                </Boton>
              )}
              <Boton variante="enlace" onClick={() => setAccion({ tipo: 'activo', usuario: u })}>
                {u.activo ? 'Desactivar' : 'Activar'}
              </Boton>
            </>
          )}
        </div>
      ),
    },
  ];

  const usuario = accion?.usuario;
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usuarios</h2>
        {pestana === 'usuarios' && (
          <Boton onClick={() => setAccion({ tipo: 'crear' })}>Nuevo usuario</Boton>
        )}
      </div>
      <Pestanas pestanas={PESTANAS} activa={pestana} alCambiar={setPestana} />
      {pestana === 'usuarios' ? (
        <Tabla columnas={columnas} filas={usuarios} />
      ) : (
        <ControlAccesos usuarios={usuarios} />
      )}

      <Modal
        abierto={accion?.tipo === 'crear' || accion?.tipo === 'editar'}
        titulo={accion?.tipo === 'crear' ? 'Nuevo usuario' : `Editar ${usuario?.correo}`}
        alCerrar={cerrar}
      >
        <UsuarioForm
          usuario={accion?.tipo === 'editar' ? usuario : null}
          mutacion={accion?.tipo === 'crear' ? crear : editar}
          alTerminar={cerrar}
          alCancelar={cerrar}
        />
      </Modal>

      <Modal
        abierto={accion?.tipo === 'contrasena'}
        titulo="Restablecer contraseña"
        alCerrar={cerrar}
      >
        <RestablecerContrasenaForm
          usuario={usuario}
          mutacion={restablecer}
          alTerminar={cerrar}
          alCancelar={cerrar}
        />
      </Modal>

      <ConfirmarModal
        abierto={accion?.tipo === 'activo'}
        titulo={usuario?.activo ? 'Desactivar usuario' : 'Activar usuario'}
        mensaje={
          usuario?.activo
            ? `${usuario.nombre} perderá el acceso de inmediato y se cerrarán sus sesiones.`
            : `${usuario?.nombre} podrá volver a iniciar sesión.`
        }
        textoConfirmar={usuario?.activo ? 'Desactivar' : 'Activar'}
        peligro={usuario?.activo}
        cargando={editar.isPending}
        error={editar.error}
        alConfirmar={() =>
          editar.mutate({ id: usuario.id, activo: !usuario.activo }, { onSuccess: cerrar })
        }
        alCancelar={cerrar}
      />

      <ConfirmarModal
        abierto={accion?.tipo === 'sesiones'}
        titulo="Cerrar sesiones"
        mensaje={`${usuario?.nombre} tendrá que volver a iniciar sesión en todos sus navegadores.`}
        textoConfirmar="Cerrar sesiones"
        peligro
        cargando={cerrarSesiones.isPending}
        error={cerrarSesiones.error}
        alConfirmar={() => cerrarSesiones.mutate({ id: usuario.id }, { onSuccess: cerrar })}
        alCancelar={cerrar}
      />
    </section>
  );
}
