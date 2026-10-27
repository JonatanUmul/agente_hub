import { withTransaction } from '../../db/transaction.js';
import { AppError, esViolacionUnica, noEncontrado } from '../../lib/app-error.js';
import { editarConVersion } from '../../lib/edicion.js';
import * as repo from './reglas.repository.js';

const CAMPOS_EDITABLES = [
  'modulo',
  'destino',
  'categoria',
  'titulo',
  'regla',
  'prioridad',
  'activo',
  'vigenteDesde',
  'vigenteHasta',
];
const CAMPOS_FECHA = ['vigenteDesde', 'vigenteHasta'];

function traducirError(error) {
  if (esViolacionUnica(error)) {
    return new AppError({
      codigo: 'CODIGO_EN_USO',
      mensaje: 'Ya existe una regla con ese código',
      estadoHttp: 409,
    });
  }
  return error;
}

export const listarReglas = (db) => repo.listar(db);

export async function obtenerRegla(db, id) {
  const regla = await repo.obtenerPorId(db, id);
  if (!regla) throw noEncontrado('Regla no encontrada');
  return regla;
}

export async function crearRegla(db, { datos, correo }) {
  try {
    return await withTransaction(db, async (client) => {
      const id = await repo.insertar(client, datos, correo);
      return repo.obtenerPorId(client, id);
    });
  } catch (error) {
    throw traducirError(error);
  }
}

const editar = (db, opciones) =>
  editarConVersion(db, {
    ...opciones,
    repo,
    campos: CAMPOS_EDITABLES,
    camposFecha: CAMPOS_FECHA,
    mensajeNoEncontrado: 'Regla no encontrada',
  });

export const editarRegla = (db, { id, datos, correo }) =>
  editar(db, { id, version: datos.version, correo, aplicar: () => datos });

export const cambiarActivoRegla = (db, { id, activo, version, correo }) =>
  editar(db, { id, version, correo, aplicar: (actual) => ({ ...actual, activo }) });
