import { withTransaction } from '../../db/transaction.js';
import {
  AppError,
  conflictoDeVersion,
  esViolacionCheck,
  esViolacionUnica,
  noEncontrado,
} from '../../lib/app-error.js';
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

// El cliente puede mandar la misma fecha con otro formato ('...Z' vs '-06:00'):
// las fechas se comparan como instantes, no como texto.
const CAMPOS_FECHA = new Set(['vigenteDesde', 'vigenteHasta']);
const comparable = (campo, valor) =>
  CAMPOS_FECHA.has(campo) && valor ? Date.parse(valor) : JSON.stringify(valor);
const hayCambios = (actual, nuevo) =>
  CAMPOS_EDITABLES.some((c) => comparable(c, actual[c]) !== comparable(c, nuevo[c]));

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

// `aplicar` recibe el estado actual y devuelve el nuevo (todo el formulario o solo `activo`).
async function editarConVersion(db, { id, version, correo, aplicar }) {
  try {
    return await withTransaction(db, async (client) => {
      const actual = await repo.obtenerEditableBloqueando(client, id);
      if (!actual) throw noEncontrado('Pauta no encontrada');
      if (actual.version !== version) throw conflictoDeVersion();

      const nuevo = aplicar(actual);
      // Guardar sin cambios no escribe: evita registros vacíos en la auditoría.
      if (hayCambios(actual, nuevo)) await repo.actualizar(client, id, nuevo, correo);
      return repo.obtenerPorId(client, id);
    });
  } catch (error) {
    throw traducirError(error);
  }
}

export const editarPauta = (db, { id, datos, correo }) =>
  editarConVersion(db, { id, version: datos.version, correo, aplicar: () => datos });

export const cambiarActivoPauta = (db, { id, activo, version, correo }) =>
  editarConVersion(db, { id, version, correo, aplicar: (actual) => ({ ...actual, activo }) });
