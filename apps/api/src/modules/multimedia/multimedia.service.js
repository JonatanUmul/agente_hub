import { withTransaction } from '../../db/transaction.js';
import {
  AppError,
  conflictoDeVersion,
  esViolacionLlaveForanea,
  esViolacionUnica,
  noEncontrado,
} from '../../lib/app-error.js';
import { editarConVersion } from '../../lib/edicion.js';
import * as repo from './multimedia.repository.js';

const CAMPOS_EDITABLES = [
  'descripcion',
  'productoId',
  'color',
  'tema',
  'pautaIds',
  'orden',
  'activo',
];

function traducirError(error) {
  if (esViolacionUnica(error)) {
    return new AppError({
      codigo: 'ARCHIVO_DUPLICADO',
      mensaje: 'Ya existe un archivo de ese tipo con el mismo ID de HubSpot',
      estadoHttp: 409,
    });
  }
  if (esViolacionLlaveForanea(error)) {
    return new AppError({
      codigo: 'REFERENCIA_INEXISTENTE',
      mensaje: 'El producto o la pauta seleccionados no existen',
      estadoHttp: 400,
    });
  }
  return error;
}

export const listarArchivos = (db) => repo.listar(db);

export async function obtenerArchivo(db, id) {
  const archivo = await repo.obtenerPorId(db, id);
  if (!archivo) throw noEncontrado('Archivo no encontrado');
  return archivo;
}

export async function crearArchivo(db, { datos, correo }) {
  try {
    return await withTransaction(db, async (client) => {
      const id = await repo.insertar(client, datos, correo);
      return repo.obtenerPorId(client, id);
    });
  } catch (error) {
    throw traducirError(error);
  }
}

async function editar(db, opciones) {
  try {
    return await editarConVersion(db, {
      ...opciones,
      repo,
      campos: CAMPOS_EDITABLES,
      mensajeNoEncontrado: 'Archivo no encontrado',
    });
  } catch (error) {
    throw traducirError(error);
  }
}

export const editarArchivo = (db, { id, datos, correo }) =>
  editar(db, { id, version: datos.version, correo, aplicar: () => datos });

export const cambiarActivoArchivo = (db, { id, activo, version, correo }) =>
  editar(db, { id, version, correo, aplicar: (actual) => ({ ...actual, activo }) });

// Arte de la pauta: imagen sin producto con pauta_id = la pauta. Al reemplazar, el arte anterior se desactiva
// (no se borra) y el nuevo toma su lugar en el orden, todo en una transacción.
export async function crearArtePauta(db, { datos, correo }) {
  const { pautaId, hubspotFileId, descripcion, reemplaza } = datos;
  try {
    return await withTransaction(db, async (client) => {
      let orden;
      if (reemplaza) {
        const anterior = await repo.obtenerEditableBloqueando(client, reemplaza.id);
        if (!anterior) throw noEncontrado('El arte a reemplazar no existe');
        if (anterior.version !== reemplaza.version) throw conflictoDeVersion();
        if (anterior.productoId !== null || !anterior.pautaIds.includes(pautaId)) {
          throw new AppError({
            codigo: 'NO_ES_ARTE_DE_LA_PAUTA',
            mensaje: 'El archivo a reemplazar no es un arte de esta pauta',
            estadoHttp: 400,
          });
        }
        await repo.actualizar(client, reemplaza.id, { ...anterior, activo: false }, correo);
        orden = anterior.orden;
      } else {
        orden = await repo.siguienteOrdenDePauta(client, pautaId);
      }
      const id = await repo.insertar(
        client,
        {
          tipo: 'imagen',
          hubspotFileId,
          descripcion,
          productoId: null,
          color: null,
          tema: null,
          pautaIds: [pautaId],
          orden,
          activo: true,
        },
        correo,
      );
      return repo.obtenerPorId(client, id);
    });
  } catch (error) {
    throw traducirError(error);
  }
}
