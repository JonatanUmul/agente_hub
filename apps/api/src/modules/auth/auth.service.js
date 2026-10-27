import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../lib/app-error.js';
import {
  hashContrasena,
  verificarContraHashFicticio,
  verificarContrasena,
} from '../../lib/contrasenas.js';
import { generarToken, hashToken } from '../../lib/tokens.js';
import * as usuariosRepo from '../usuarios/usuarios.repository.js';
import * as repo from './auth.repository.js';

// Mismo error para correo inexistente, contraseña incorrecta, cuenta inactiva o bloqueada:
// no le decimos a un atacante cuál de esas cosas acertó.
const credencialesInvalidas = () =>
  new AppError({
    codigo: 'CREDENCIALES_INVALIDAS',
    mensaje:
      'Correo o contraseña incorrectos. Tras varios intentos fallidos la cuenta se bloquea unos minutos.',
    estadoHttp: 401,
  });

export async function iniciarSesion(db, config, { correo, contrasena }) {
  const usuario = await repo.buscarParaLogin(db, correo);
  if (!usuario) {
    await verificarContraHashFicticio(contrasena);
    throw credencialesInvalidas();
  }

  // Verificamos siempre, aun bloqueada, para que todas las respuestas tarden lo mismo.
  const valida = await verificarContrasena(usuario.hash_contrasena, contrasena);
  if (usuario.bloqueado || !usuario.activo) throw credencialesInvalidas();
  if (!valida) {
    await repo.registrarIntentoFallido(db, usuario.id, {
      maxIntentos: config.LOGIN_MAX_INTENTOS,
      minutosBloqueo: config.LOGIN_BLOQUEO_MINUTOS,
    });
    throw credencialesInvalidas();
  }

  const token = generarToken();
  const csrfToken = generarToken();
  await withTransaction(db, async (client) => {
    await repo.registrarAccesoExitoso(client, usuario.id);
    await repo.eliminarSesionesVencidas(client, usuario.id);
    await repo.crearSesion(client, {
      tokenHash: hashToken(token),
      usuarioId: usuario.id,
      csrfToken,
      horas: config.SESION_TTL_HORAS,
    });
  });

  const sesion = await repo.buscarSesionVigente(db, hashToken(token));
  return { token, ...sesion };
}

// Devuelve { usuario, csrfToken } o null si el token no corresponde a una sesión vigente.
export async function obtenerSesion(db, token) {
  if (!token) return null;
  return repo.buscarSesionVigente(db, hashToken(token));
}

export async function cerrarSesion(db, token) {
  if (token) await repo.eliminarSesion(db, hashToken(token));
}

// Cambiar la propia contraseña cierra las demás sesiones (por si alguien más la conocía).
export async function cambiarContrasenaPropia(db, { usuarioId, token, actual, nueva }) {
  const hashActual = await usuariosRepo.obtenerHash(db, usuarioId);
  if (!hashActual || !(await verificarContrasena(hashActual, actual))) {
    throw new AppError({
      codigo: 'CONTRASENA_ACTUAL_INCORRECTA',
      mensaje: 'La contraseña actual no es correcta',
      estadoHttp: 400,
    });
  }

  const hashNuevo = await hashContrasena(nueva);
  await withTransaction(db, async (client) => {
    await usuariosRepo.actualizarHash(client, usuarioId, hashNuevo);
    await repo.eliminarSesionesDeUsuario(client, usuarioId, hashToken(token));
  });
}
