// SQL de horarios de agentes (eco_agentes_horario, eco_agentes_descanso; docs/sql/002).
// Los agentes vienen de hubspot_agentes, que sincroniza n8n: la app solo lee algunas columnas.

// en_horario lo calcula la base con la misma función que usa el bot.
export async function listarAgentes(db) {
  const { rows } = await db.query(
    `SELECT a.id, a.nombre, a.apellido, a.email, a.bandeja, a.canal, a.estado_agente,
            eco_agente_en_horario(a.id) AS en_horario
     FROM hubspot_agentes a
     WHERE NOT a.archived
     ORDER BY (a.estado_agente = 'activo') DESC NULLS LAST, a.bandeja NULLS LAST, a.nombre, a.id`,
  );
  return rows.map((f) => ({
    id: Number(f.id), // bigint llega como string; los id de HubSpot caben en un Number
    nombre: f.nombre,
    apellido: f.apellido,
    email: f.email,
    bandeja: f.bandeja,
    canal: f.canal,
    estadoAgente: f.estado_agente,
    enHorarioAhora: f.en_horario,
  }));
}

export async function existeAgente(db, agenteId) {
  const { rowCount } = await db.query(`SELECT 1 FROM hubspot_agentes WHERE id = $1`, [agenteId]);
  return rowCount === 1;
}

// '24:00' (fin de día) se conserva tal cual; el resto en HH:MM.
const HORA = (columna) =>
  `CASE WHEN ${columna} = '24:00' THEN '24:00' ELSE to_char(${columna}, 'HH24:MI') END`;

export async function listarRangos(db, agenteIds) {
  const { rows } = await db.query(
    `SELECT id, agente_id, dia_semana, ${HORA('hora_inicio')} AS hora_inicio, ${HORA('hora_fin')} AS hora_fin
     FROM eco_agentes_horario
     WHERE agente_id = ANY($1::bigint[])
     ORDER BY agente_id, dia_semana, hora_inicio`,
    [agenteIds],
  );
  return rows.map((f) => ({
    id: f.id,
    agenteId: Number(f.agente_id),
    diaSemana: f.dia_semana,
    horaInicio: f.hora_inicio,
    horaFin: f.hora_fin,
  }));
}

// Descansos de hoy (hora de Guatemala) en adelante; los pasados quedan en el historial.
export async function listarDescansos(db, agenteIds) {
  const { rows } = await db.query(
    `SELECT id, agente_id, desde::text AS desde, hasta::text AS hasta, motivo
     FROM eco_agentes_descanso
     WHERE agente_id = ANY($1::bigint[])
       AND hasta >= (now() AT TIME ZONE 'America/Guatemala')::date
     ORDER BY agente_id, desde`,
    [agenteIds],
  );
  return rows.map((f) => ({
    id: f.id,
    agenteId: Number(f.agente_id),
    desde: f.desde,
    hasta: f.hasta,
    motivo: f.motivo,
  }));
}

// Versión del horario: cambia cada vez que se reemplaza (los id de los rangos son nuevos).
// Misma fórmula que calcularVersion() pero en la base, para leerla dentro de la transacción.
export const calcularVersion = (rangos) =>
  `${rangos.length}-${rangos.reduce((max, r) => Math.max(max, r.id), 0)}`;

export async function versionHorario(db, agenteId) {
  const { rows } = await db.query(
    `SELECT count(*) || '-' || COALESCE(max(id), 0) AS version FROM eco_agentes_horario WHERE agente_id = $1`,
    [agenteId],
  );
  return rows[0].version;
}

// Serializa los cambios de horario de un mismo agente hasta el fin de la transacción.
// (eco_app no puede bloquear filas de hubspot_agentes, que es de n8n.)
export async function bloquearAgente(db, agenteId) {
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('eco_agentes_horario'), $1::int)`, [
    agenteId % 2147483647,
  ]);
}

// Reemplaza la semana completa: borra los rangos y vuelve a insertarlos.
export async function reemplazarRangos(db, agenteId, rangos, actualizadoPor) {
  await db.query(`DELETE FROM eco_agentes_horario WHERE agente_id = $1`, [agenteId]);
  if (rangos.length === 0) return;
  await db.query(
    `INSERT INTO eco_agentes_horario (agente_id, dia_semana, hora_inicio, hora_fin, actualizado_por)
     SELECT $1, d, i::time, f::time, $5
     FROM unnest($2::smallint[], $3::text[], $4::text[]) AS t(d, i, f)`,
    [
      agenteId,
      rangos.map((r) => r.diaSemana),
      rangos.map((r) => r.horaInicio),
      rangos.map((r) => r.horaFin),
      actualizadoPor,
    ],
  );
}

export async function insertarDescanso(db, agenteId, { desde, hasta, motivo }, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_agentes_descanso (agente_id, desde, hasta, motivo, actualizado_por)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, desde::text AS desde, hasta::text AS hasta, motivo`,
    [agenteId, desde, hasta, motivo, actualizadoPor],
  );
  return rows[0];
}

export async function borrarDescanso(db, agenteId, descansoId) {
  const { rowCount } = await db.query(
    `DELETE FROM eco_agentes_descanso WHERE id = $1 AND agente_id = $2`,
    [descansoId, agenteId],
  );
  return rowCount === 1;
}
