import { withTransaction } from '../../db/transaction.js';
import { conflictoDeVersion, noEncontrado } from '../../lib/app-error.js';
import * as repo from './agentes.repository.js';

// Agrupa los rangos por día (1–7); un día sin rangos queda con lista vacía (= descansa).
function semana(rangos) {
  return [1, 2, 3, 4, 5, 6, 7].map((diaSemana) => ({
    diaSemana,
    rangos: rangos
      .filter((r) => r.diaSemana === diaSemana)
      .map(({ horaInicio, horaFin }) => ({ horaInicio, horaFin })),
  }));
}

const aplanar = (dias) =>
  dias.flatMap((d) => d.rangos.map((r) => ({ diaSemana: d.diaSemana, ...r })));
const clave = (rangos) =>
  JSON.stringify(
    [...rangos].sort(
      (a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio),
    ),
  );

export async function listarAgentes(db) {
  const agentes = await repo.listarAgentes(db);
  const ids = agentes.map((a) => a.id);
  const [rangos, descansos] = await Promise.all([
    repo.listarRangos(db, ids),
    repo.listarDescansos(db, ids),
  ]);

  return agentes.map((a) => {
    const suyos = rangos.filter((r) => r.agenteId === a.id);
    return {
      ...a,
      horario: semana(suyos),
      descansos: descansos
        .filter((d) => d.agenteId === a.id)
        .map(({ id, desde, hasta, motivo }) => ({ id, desde, hasta, motivo })),
      version: repo.calcularVersion(suyos),
    };
  });
}

async function verificarAgente(db, agenteId) {
  if (!(await repo.existeAgente(db, agenteId))) throw noEncontrado('Agente no encontrado');
}

// Reemplaza el horario semanal completo. `version` evita pisar el cambio de otra persona.
export async function guardarHorario(db, { agenteId, dias, version, correo }) {
  await withTransaction(db, async (client) => {
    await verificarAgente(client, agenteId);
    await repo.bloquearAgente(client, agenteId);
    if ((await repo.versionHorario(client, agenteId)) !== version) throw conflictoDeVersion();

    const nuevos = aplanar(dias);
    const actuales = await repo.listarRangos(client, [agenteId]);
    // Sin cambios no se escribe: evita borrar e insertar las mismas filas (y su auditoría).
    if (
      clave(
        actuales.map(({ diaSemana, horaInicio, horaFin }) => ({ diaSemana, horaInicio, horaFin })),
      ) !== clave(nuevos)
    ) {
      await repo.reemplazarRangos(client, agenteId, nuevos, correo);
    }
  });
}

export async function agregarDescanso(db, { agenteId, datos, correo }) {
  return withTransaction(db, async (client) => {
    await verificarAgente(client, agenteId);
    return repo.insertarDescanso(client, agenteId, datos, correo);
  });
}

export async function quitarDescanso(db, { agenteId, descansoId }) {
  if (!(await repo.borrarDescanso(db, agenteId, descansoId)))
    throw noEncontrado('Descanso no encontrado');
}
