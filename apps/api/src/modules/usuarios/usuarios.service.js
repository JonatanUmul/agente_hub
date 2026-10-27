import { withTransaction } from '../../db/transaction.js';
import { AppError, esViolacionUnica, noEncontrado } from '../../lib/app-error.js';
import { hashContrasena } from '../../lib/contrasenas.js';
import { eliminarSesionesDeUsuario } from '../auth/auth.repository.js';
import * as repo from './usuarios.repository.js';

export const listarUsuarios = (db) => repo.listar(db);

export async function crearUsuario(db, { correo, nombre, rol, contrasena }) {
  try {
    return await repo.insertar(db, {
      correo,
      nombre,
      rol,
      hashContrasena: await hashContrasena(contrasena),
    });
  } catch (error) {
    if (esViolacionUnica(error)) {
      throw new AppError({
        codigo: 'CORREO_EN_USO',
        mensaje: 'Ya existe un usuario con ese correo',
        estadoHttp: 409,
      });
    }
    throw error;
  }
}

// `actorId` es quien hace el cambio (para impedir que un admin se desactive a sí mismo).
export async function editarUsuario(db, { id, cambios, actorId }) {
  if (id === actorId && cambios.activo === false) {
    throw new AppError({
      codigo: 'NO_AUTODESACTIVAR',
      mensaje: 'No puedes desactivar tu propia cuenta',
      estadoHttp: 409,
    });
  }

  return withTransaction(db, async (client) => {
    const actual = await repo.obtenerPorId(client, id);
    if (!actual) throw noEncontrado('Usuario no encontrado');

    const dejaDeSerAdminActivo =
      actual.rol === 'admin' &&
      actual.activo &&
      ((cambios.rol !== undefined && cambios.rol !== 'admin') || cambios.activo === false);

    if (dejaDeSerAdminActivo) {
      const admins = await repo.idsAdminsActivosBloqueando(client);
      if (admins.filter((adminId) => adminId !== id).length === 0) {
        throw new AppError({
          codigo: 'ULTIMO_ADMIN',
          mensaje: 'Debe quedar al menos un administrador activo',
          estadoHttp: 409,
        });
      }
    }

    const actualizado = await repo.actualizar(client, id, cambios);
    // Desactivar corta el acceso de inmediato, también en otros navegadores.
    if (cambios.activo === false) await eliminarSesionesDeUsuario(client, id);
    return actualizado;
  });
}

// Lo usa un admin cuando alguien olvidó su contraseña o quedó bloqueado.
export async function restablecerContrasena(db, { id, contrasena }) {
  const hash = await hashContrasena(contrasena);
  await withTransaction(db, async (client) => {
    if (!(await repo.actualizarHash(client, id, hash))) throw noEncontrado('Usuario no encontrado');
    await eliminarSesionesDeUsuario(client, id);
  });
}
