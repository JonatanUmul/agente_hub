import { withTransaction } from '../../db/transaction.js';
import { AppError, esViolacionUnica, noEncontrado } from '../../lib/app-error.js';
import { editarConVersion } from '../../lib/edicion.js';
import * as repo from './preguntas.repository.js';

const CAMPOS_EDITABLES = [
  'pregunta',
  'tema',
  'palabrasClave',
  'respuesta',
  'modulos',
  'orden',
  'activo',
];

export const listarPreguntas = (db) => repo.listar(db);

// Sugerencia para el formulario; si dos personas crean a la vez, el UNIQUE de la base decide.
export const siguienteNumero = (db) => repo.siguienteNumero(db);

export async function obtenerPregunta(db, id) {
  const pregunta = await repo.obtenerPorId(db, id);
  if (!pregunta) throw noEncontrado('Pregunta no encontrada');
  return pregunta;
}

export async function crearPregunta(db, { datos, correo }) {
  try {
    return await withTransaction(db, async (client) => {
      const id = await repo.insertar(client, datos, correo);
      return repo.obtenerPorId(client, id);
    });
  } catch (error) {
    if (esViolacionUnica(error)) {
      throw new AppError({
        codigo: 'NUMERO_EN_USO',
        mensaje: `Ya existe la pregunta número ${datos.numero}`,
        estadoHttp: 409,
      });
    }
    throw error;
  }
}

const editar = (db, opciones) =>
  editarConVersion(db, {
    ...opciones,
    repo,
    campos: CAMPOS_EDITABLES,
    mensajeNoEncontrado: 'Pregunta no encontrada',
  });

export const editarPregunta = (db, { id, datos, correo }) =>
  editar(db, { id, version: datos.version, correo, aplicar: () => datos });

export const cambiarActivoPregunta = (db, { id, activo, version, correo }) =>
  editar(db, { id, version, correo, aplicar: (actual) => ({ ...actual, activo }) });
