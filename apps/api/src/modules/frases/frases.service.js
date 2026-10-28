import { withTransaction } from '../../db/transaction.js';
import {
  AppError,
  conflictoDeVersion,
  esViolacionUnica,
  noEncontrado,
} from '../../lib/app-error.js';
import { editarConVersion } from '../../lib/edicion.js';
import { cambiarInterruptor } from '../configuracion/configuracion.service.js';
import * as repo from './frases.repository.js';

const CAMPOS_EDITABLES = ['modulo', 'situacion', 'frase', 'activo'];
const NO_ENCONTRADA = 'Frase no encontrada';

// UNIQUE (modulo, situacion, frase): la misma frase dos veces en un grupo sería una opción repetida.
function traducirError(error) {
  if (esViolacionUnica(error)) {
    return new AppError({
      codigo: 'FRASE_REPETIDA',
      mensaje: 'Esa frase ya existe para ese módulo y situación',
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

export const listarFrases = (db, filtros = {}) =>
  repo.listar(db, {
    modulo: filtros.modulo ?? null,
    situacion: filtros.situacion ?? null,
    activo: filtros.activo === undefined ? null : filtros.activo === 'true',
  });

export const crearFrase = (db, { datos, correo }) =>
  conErrores(() =>
    withTransaction(db, async (client) => {
      const id = await repo.insertar(client, datos, correo);
      return repo.obtenerPorId(client, id);
    }),
  );

const editar = (db, opciones) =>
  conErrores(() =>
    editarConVersion(db, {
      ...opciones,
      repo,
      campos: CAMPOS_EDITABLES,
      mensajeNoEncontrado: NO_ENCONTRADA,
    }),
  );

export const editarFrase = (db, { id, datos, correo }) =>
  editar(db, { id, version: datos.version, correo, aplicar: () => datos });

export const cambiarActivoFrase = (db, { id, activo, version, correo }) =>
  editar(db, { id, version, correo, aplicar: (actual) => ({ ...actual, activo }) });

// Borrar definitivamente (la web sugiere desactivar). También con `version`: no se borra una frase
// que otra persona acaba de cambiar sin que la hayas visto.
export const eliminarFrase = (db, { id, version, correo }) =>
  withTransaction(db, async (client) => {
    const actual = await repo.obtenerEditableBloqueando(client, id);
    if (!actual) throw noEncontrado(NO_ENCONTRADA);
    if (actual.version !== version) throw conflictoDeVersion();
    await repo.eliminar(client, id, correo);
  });

// Reordena un grupo: todas las frases deben existir y ser del mismo módulo y situación (el orden solo
// tiene sentido dentro del grupo entre el que el bot elige). Solo escribe las que cambian.
export const reordenarFrases = (db, { lista, correo }) =>
  withTransaction(db, async (client) => {
    const filas = await repo.gruposBloqueando(
      client,
      lista.map((f) => f.id),
    );
    if (filas.length !== lista.length) throw noEncontrado('Alguna de las frases ya no existe');
    if (new Set(filas.map((f) => `${f.modulo}/${f.situacion}`)).size > 1) {
      throw new AppError({
        codigo: 'GRUPOS_DISTINTOS',
        mensaje: 'Solo se puede reordenar dentro de un mismo módulo y situación',
        estadoHttp: 400,
      });
    }
    const ordenActual = new Map(filas.map((f) => [f.id, f.orden]));
    for (const { id, orden } of lista) {
      if (ordenActual.get(id) !== orden) await repo.cambiarOrden(client, id, orden, correo);
    }
    return repo.listar(client, { modulo: filas[0].modulo, situacion: filas[0].situacion });
  });

// El interruptor vive en eco_configuracion; aquí solo cambia el permiso (frases:editar).
export const cambiarCierreAutomatico = (db, { habilitado, correo }) =>
  cambiarInterruptor(db, { clave: 'cierre_automatico', habilitado, correo });
