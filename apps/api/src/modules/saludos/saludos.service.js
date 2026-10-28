import {
  ahoraEnGuatemala,
  candidatosSaludo,
  choquesDeSaludo,
  momentoDelDia,
  resolverSaludo,
  vigenteEn,
} from '@ecofiltro/shared';
import { withTransaction } from '../../db/transaction.js';
import {
  AppError,
  conflictoDeVersion,
  esViolacionUnica,
  noEncontrado,
} from '../../lib/app-error.js';
import { editarConVersion } from '../../lib/edicion.js';
import * as config from '../configuracion/configuracion.repository.js';
import * as repo from './saludos.repository.js';

const CAMPOS_EDITABLES = [
  'nombre',
  'modulo',
  'saludo',
  'fechaInicio',
  'fechaFin',
  'repetirAnual',
  'prioridad',
  'activo',
];
const NO_ENCONTRADO = 'Saludo no encontrado';
const CLAVE_MENU = 'menu_bienvenida_texto';

function traducirError(error) {
  if (esViolacionUnica(error)) {
    return new AppError({
      codigo: 'NOMBRE_EN_USO',
      mensaje: 'Ya existe un saludo con ese nombre en ese módulo',
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

const conVigencia = (s, hoy) => ({ ...s, vigenteHoy: s.activo && vigenteEn(s, hoy) });

export async function listarSaludos(db, filtros = {}) {
  const { fecha } = ahoraEnGuatemala();
  const lista = (
    await repo.listar(db, {
      modulo: filtros.modulo ?? null,
      activo: filtros.activo === undefined ? null : filtros.activo === 'true',
    })
  ).map((s) => conVigencia(s, fecha));
  if (filtros.vigentesHoy === undefined) return lista;
  return lista.filter((s) => s.vigenteHoy === (filtros.vigentesHoy === 'true'));
}

// Respuesta de crear y editar: el saludo y, sin bloquear, los que chocan con él (mismo módulo, prioridad y días).
async function conChoques(client, id) {
  const { fecha } = ahoraEnGuatemala();
  const saludo = conVigencia(await repo.obtenerPorId(client, id), fecha);
  const todos = await repo.listar(client);
  const choques = choquesDeSaludo(saludo, todos, fecha).map((s) => ({
    id: s.id,
    nombre: s.nombre,
  }));
  return { ...saludo, choques };
}

export const crearSaludo = (db, { datos, correo }) =>
  conErrores(() =>
    withTransaction(db, async (client) =>
      conChoques(client, await repo.insertar(client, datos, correo)),
    ),
  );

export const editarSaludo = async (db, { id, datos, correo }) => {
  await conErrores(() =>
    editarConVersion(db, {
      id,
      version: datos.version,
      correo,
      repo,
      campos: CAMPOS_EDITABLES,
      mensajeNoEncontrado: NO_ENCONTRADO,
      aplicar: () => datos,
    }),
  );
  return conChoques(db, id);
};

export async function cambiarActivoSaludo(db, { id, activo, version, correo }) {
  const saludo = await editarConVersion(db, {
    id,
    version,
    correo,
    repo,
    campos: CAMPOS_EDITABLES,
    mensajeNoEncontrado: NO_ENCONTRADO,
    aplicar: (actual) => ({ ...actual, activo }),
  });
  return conVigencia(saludo, ahoraEnGuatemala().fecha);
}

export const eliminarSaludo = (db, { id, version, correo }) =>
  withTransaction(db, async (client) => {
    const actual = await repo.obtenerEditableBloqueando(client, id);
    if (!actual) throw noEncontrado(NO_ENCONTRADO);
    if (actual.version !== version) throw conflictoDeVersion();
    await repo.eliminar(client, id, correo);
  });

// Lo que el bot usa ahora: lo resuelve la propia base con eco_saludo().
export const saludoVigente = async (db, modulo) => ({
  modulo,
  saludo: await repo.saludoDeHoy(db, modulo),
});

// Misma lógica que eco_saludo() para otra fecha y hora. Con empate devuelve todos los candidatos.
export async function simularSaludo(db, { modulo, fecha, hora }) {
  const candidatos = candidatosSaludo(await repo.listar(db), modulo, fecha).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    modulo: s.modulo,
    prioridad: s.prioridad,
    saludo: resolverSaludo(s.saludo, hora),
  }));
  return {
    modulo,
    fecha,
    hora,
    momento: momentoDelDia(hora),
    saludo: candidatos.length === 1 ? candidatos[0].saludo : null,
    candidatos,
  };
}

export async function leerTextoMenu(db) {
  const texto = await config.leerTexto(db, CLAVE_MENU);
  if (!texto) throw noEncontrado(`La clave ${CLAVE_MENU} no existe en eco_configuracion`);
  return texto;
}

export const guardarTextoMenu = (db, { texto, version, correo }) =>
  withTransaction(db, async (client) => {
    const actual = await config.leerTexto(client, CLAVE_MENU, { bloquear: true });
    if (!actual) throw noEncontrado(`La clave ${CLAVE_MENU} no existe en eco_configuracion`);
    if (actual.version !== version) throw conflictoDeVersion();
    if (actual.texto !== texto) {
      await config.actualizarTexto(client, { clave: CLAVE_MENU, texto, actualizadoPor: correo });
    }
    return config.leerTexto(client, CLAVE_MENU);
  });
