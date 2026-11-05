import { withTransaction } from '../../db/transaction.js';
import { AppError, esViolacionUnica, noEncontrado } from '../../lib/app-error.js';
import { hashContrasena } from '../../lib/contrasenas.js';
import { registrarEvento } from '../accesos/accesos.repository.js';
import { eliminarSesionesDeUsuario } from '../auth/auth.repository.js';
import * as repo from './usuarios.repository.js';

export const listarUsuarios = (db) => repo.listar(db);

// `actor`: { correo, ip } de quien hace el cambio; sin actor (consola) queda como 'consola'.
const anotar = (db, usuario, evento, actor, detalle) =>
  registrarEvento(db, {
    usuarioId: usuario.id,
    correo: usuario.correo,
    evento,
    detalle,
    hechoPor: actor?.correo ?? 'consola',
    ip: actor?.ip,
  });

export async function crearUsuario(db, { correo, nombre, rol, contrasena }, actor) {
  const hash = await hashContrasena(contrasena);
  try {
    return await withTransaction(db, async (client) => {
      const usuario = await repo.insertar(client, { correo, nombre, rol, hashContrasena: hash });
      await anotar(client, usuario, 'creado', actor, { rol });
      return usuario;
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

// Lo que cambió de nombre o rol, como { campo: { antes, despues } }; null si nada.
function cambiosDeDatos(actual, cambios) {
  const detalle = {};
  for (const campo of ['nombre', 'rol']) {
    if (cambios[campo] !== undefined && cambios[campo] !== actual[campo]) {
      detalle[campo] = { antes: actual[campo], despues: cambios[campo] };
    }
  }
  return Object.keys(detalle).length ? detalle : null;
}

// `actor` es quien hace el cambio (para impedir que un admin se desactive a sí mismo).
export async function editarUsuario(db, { id, cambios, actor }) {
  if (id === actor?.id && cambios.activo === false) {
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
    if (cambios.activo === false) {
      await eliminarSesionesDeUsuario(client, id, { motivo: 'desactivado' });
    }
    const detalle = cambiosDeDatos(actual, cambios);
    if (detalle) await anotar(client, actual, 'editado', actor, detalle);
    if (cambios.activo !== undefined && cambios.activo !== actual.activo) {
      await anotar(client, actual, cambios.activo ? 'activado' : 'desactivado', actor);
    }
    return actualizado;
  });
}

// Lo usa un admin cuando alguien olvidó su contraseña o quedó bloqueado.
export async function restablecerContrasena(db, { id, contrasena, actor }) {
  const hash = await hashContrasena(contrasena);
  await withTransaction(db, async (client) => {
    const usuario = await repo.obtenerPorId(client, id);
    if (!usuario || !(await repo.actualizarHash(client, id, hash))) {
      throw noEncontrado('Usuario no encontrado');
    }
    await eliminarSesionesDeUsuario(client, id, { motivo: 'contrasena' });
    await anotar(client, usuario, 'contrasena_restablecida', actor);
  });
}

// Saca al usuario de todos sus navegadores sin cambiarle nada más.
export async function cerrarSesiones(db, { id, actor }) {
  await withTransaction(db, async (client) => {
    const usuario = await repo.obtenerPorId(client, id);
    if (!usuario) throw noEncontrado('Usuario no encontrado');
    await eliminarSesionesDeUsuario(client, id, { motivo: 'cerrada_por_admin' });
    await anotar(client, usuario, 'sesiones_cerradas', actor);
  });
}
