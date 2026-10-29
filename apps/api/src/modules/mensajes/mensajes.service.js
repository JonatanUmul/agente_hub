import { MENSAJES_PROTEGIDOS, errorTextoMensaje } from '@ecofiltro/shared';
import { withTransaction } from '../../db/transaction.js';
import {
  AppError,
  conflictoDeVersion,
  esViolacionUnica,
  noEncontrado,
} from '../../lib/app-error.js';
import * as repo from './mensajes.repository.js';

const NO_ENCONTRADO = 'Mensaje no encontrado';

const error400 = (codigo, mensaje) => new AppError({ codigo, mensaje, estadoHttp: 400 });

function traducirError(error) {
  if (esViolacionUnica(error)) {
    return new AppError({
      codigo: 'TEXTO_REPETIDO',
      mensaje: 'Ese texto ya existe para este mensaje',
      estadoHttp: 409,
    });
  }
  return error;
}
const conErrores = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    throw traducirError(error);
  }
};

function validarTexto(texto, tipo) {
  const error = errorTextoMensaje(texto, tipo);
  if (error) throw error400('TEXTO_INVALIDO', error);
}

// Un mensaje de un solo uso (varias = false) no puede tener dos versiones activas.
function validarUnaActiva(tipo, versiones) {
  if (!tipo.varias && versiones.filter((v) => v.activo).length > 1) {
    throw error400('UNA_SOLA_VERSION', 'Este mensaje admite una sola versión activa');
  }
}

// Dejar sin versiones activas un mensaje protegido exige `confirmar` (el bot volvería a su texto por defecto).
function validarProtegido(clave, versiones, confirmar) {
  if (MENSAJES_PROTEGIDOS.includes(clave) && !versiones.some((v) => v.activo) && !confirmar) {
    throw new AppError({
      codigo: 'ULTIMA_VERSION',
      mensaje: 'Es la última versión activa: el bot usará su texto por defecto',
      estadoHttp: 409,
    });
  }
}

async function tipoDe(db, clave) {
  const tipo = await repo.obtenerTipo(db, clave);
  if (!tipo) throw error400('CLAVE_INEXISTENTE', `No existe el mensaje ${clave}`);
  return tipo;
}

// Catálogo con sus versiones, en el orden de presentación.
export async function listarMensajes(db) {
  const [tipos, versiones] = await Promise.all([repo.listarTipos(db), repo.listarVersiones(db)]);
  return tipos.map((t) => ({ ...t, versiones: versiones.filter((v) => v.clave === t.clave) }));
}

export const crearMensaje = (db, { datos, correo }) =>
  conErrores(() =>
    withTransaction(db, async (client) => {
      const tipo = await tipoDe(client, datos.clave);
      validarTexto(datos.texto, tipo);
      const versiones = await repo.versionesBloqueando(client, tipo.clave);
      validarUnaActiva(tipo, [...versiones, { activo: datos.activo }]);
      const id = await repo.insertar(client, datos, correo);
      return repo.obtenerPorId(client, id);
    }),
  );

// Edición y activación comparten el mismo camino: bloquear la clave, verificar versión y reglas, escribir.
const modificar = (db, { id, version, confirmar, correo, aplicar }) =>
  conErrores(() =>
    withTransaction(db, async (client) => {
      const actual = await repo.obtenerPorId(client, id);
      if (!actual) throw noEncontrado(NO_ENCONTRADO);
      const tipo = await tipoDe(client, actual.clave);
      const versiones = await repo.versionesBloqueando(client, actual.clave);
      const bloqueada = versiones.find((v) => v.id === id);
      if (bloqueada.version !== version) throw conflictoDeVersion();
      const nuevo = aplicar(bloqueada);
      // Solo se valida el texto si cambia: activar un texto antiguo no debe fallar por reglas nuevas.
      if (nuevo.texto !== bloqueada.texto) validarTexto(nuevo.texto, tipo);
      const despues = versiones.map((v) => (v.id === id ? { ...v, ...nuevo } : v));
      validarUnaActiva(tipo, despues);
      validarProtegido(tipo.clave, despues, confirmar);
      if (nuevo.texto !== bloqueada.texto || nuevo.activo !== bloqueada.activo) {
        await repo.actualizar(client, id, nuevo, correo);
      }
      return repo.obtenerPorId(client, id);
    }),
  );

export const editarMensaje = (db, { id, datos, correo }) =>
  modificar(db, {
    id,
    version: datos.version,
    confirmar: datos.confirmar,
    correo,
    aplicar: () => ({ texto: datos.texto, activo: datos.activo }),
  });

export const cambiarActivoMensaje = (db, { id, activo, version, confirmar, correo }) =>
  modificar(db, {
    id,
    version,
    confirmar,
    correo,
    aplicar: (actual) => ({ texto: actual.texto, activo }),
  });

export const eliminarMensaje = (db, { id, version, confirmar, correo }) =>
  withTransaction(db, async (client) => {
    const actual = await repo.obtenerPorId(client, id);
    if (!actual) throw noEncontrado(NO_ENCONTRADO);
    const versiones = await repo.versionesBloqueando(client, actual.clave);
    if (versiones.find((v) => v.id === id).version !== version) throw conflictoDeVersion();
    validarProtegido(
      actual.clave,
      versiones.filter((v) => v.id !== id),
      confirmar,
    );
    await repo.eliminar(client, id, correo);
  });

// Reordena las versiones de una misma clave (con una sola clave el orden decide cuál usa el bot).
export const reordenarMensajes = (db, { lista, correo }) =>
  withTransaction(db, async (client) => {
    const filas = await repo.gruposBloqueando(
      client,
      lista.map((m) => m.id),
    );
    if (filas.length !== lista.length) throw noEncontrado('Alguna versión ya no existe');
    if (new Set(filas.map((f) => f.clave)).size > 1) {
      throw error400('CLAVES_DISTINTAS', 'Solo se puede reordenar dentro de un mismo mensaje');
    }
    const ordenActual = new Map(filas.map((f) => [f.id, f.orden]));
    for (const { id, orden } of lista) {
      if (ordenActual.get(id) !== orden) await repo.cambiarOrden(client, id, orden, correo);
    }
    return repo.listarVersiones(client, filas[0].clave);
  });
