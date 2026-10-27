import { withTransaction } from '../../db/transaction.js';
import { AppError, esViolacionCheck, esViolacionUnica, noEncontrado } from '../../lib/app-error.js';
import { editarConVersion } from '../../lib/edicion.js';
import * as repo from './pautas.repository.js';

const CAMPOS_EDITABLES = [
  'nombre',
  'mensajeCliente',
  'descuentoPct',
  'palabrasClave',
  'vigenteDesde',
  'vigenteHasta',
  'activo',
];
const CAMPOS_FECHA = ['vigenteDesde', 'vigenteHasta'];

// Zod ya valida todo esto; la base es la última barrera y traducimos sus errores por si acaso.
function traducirError(error) {
  if (esViolacionUnica(error)) {
    return new AppError({
      codigo: 'CODIGO_EN_USO',
      mensaje: 'Ya existe una pauta con ese código',
      estadoHttp: 409,
    });
  }
  if (esViolacionCheck(error)) {
    return new AppError({
      codigo: 'DATOS_INVALIDOS',
      mensaje: 'Revisa el descuento y que "vigente hasta" sea posterior a "vigente desde"',
      estadoHttp: 400,
    });
  }
  return error;
}

export const listarPautas = (db) => repo.listar(db);
export const listarPautasResumen = (db) => repo.listarResumen(db);

export async function obtenerPauta(db, id) {
  const pauta = await repo.obtenerPorId(db, id);
  if (!pauta) throw noEncontrado('Pauta no encontrada');
  return pauta;
}

export async function crearPauta(db, { datos, correo }) {
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
      camposFecha: CAMPOS_FECHA,
      mensajeNoEncontrado: 'Pauta no encontrada',
    });
  } catch (error) {
    throw traducirError(error);
  }
}

export const editarPauta = (db, { id, datos, correo }) =>
  editar(db, { id, version: datos.version, correo, aplicar: () => datos });

export const cambiarActivoPauta = (db, { id, activo, version, correo }) =>
  editar(db, { id, version, correo, aplicar: (actual) => ({ ...actual, activo }) });
