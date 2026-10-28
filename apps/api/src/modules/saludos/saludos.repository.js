// SQL de eco_saludos. Las fechas se leen como texto 'YYYY-MM-DD': un `date` convertido a Date de JS
// podría correrse un día por la zona horaria.
const SELECT_SALUDO = `
  SELECT id, nombre, modulo, saludo, fecha_inicio::text AS fecha_inicio, fecha_fin::text AS fecha_fin,
         repetir_anual, prioridad, activo, actualizado_en, actualizado_por, actualizado_en::text AS version
  FROM eco_saludos`;

function aSaludo(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    modulo: fila.modulo,
    saludo: fila.saludo,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    repetirAnual: fila.repetir_anual,
    prioridad: fila.prioridad,
    activo: fila.activo,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

export async function listar(db, { modulo = null, activo = null } = {}) {
  const { rows } = await db.query(
    `${SELECT_SALUDO}
     WHERE ($1::text IS NULL OR modulo = $1) AND ($2::boolean IS NULL OR activo = $2)
     ORDER BY prioridad DESC, fecha_inicio NULLS FIRST, id`,
    [modulo, activo],
  );
  return rows.map(aSaludo);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`${SELECT_SALUDO} WHERE id = $1`, [id]);
  return rows[0] ? aSaludo(rows[0]) : null;
}

const valores = (d) => [
  d.nombre,
  d.modulo,
  d.saludo,
  d.fechaInicio,
  d.fechaFin,
  d.repetirAnual,
  d.prioridad,
  d.activo,
];

export async function insertar(db, datos, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_saludos
       (nombre, modulo, saludo, fecha_inicio, fecha_fin, repetir_anual, prioridad, activo, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [...valores(datos), actualizadoPor],
  );
  return rows[0].id;
}

export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(`${SELECT_SALUDO} WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] ? aSaludo(rows[0]) : null;
}

export async function actualizar(db, id, datos, actualizadoPor) {
  await db.query(
    `UPDATE eco_saludos
     SET nombre = $2, modulo = $3, saludo = $4, fecha_inicio = $5, fecha_fin = $6, repetir_anual = $7,
         prioridad = $8, activo = $9, actualizado_por = $10
     WHERE id = $1`,
    [id, ...valores(datos), actualizadoPor],
  );
}

// Se anota quién borra antes del DELETE, para que el historial lo atribuya bien.
export async function eliminar(db, id, actualizadoPor) {
  await db.query(`UPDATE eco_saludos SET actualizado_por = $2 WHERE id = $1`, [id, actualizadoPor]);
  await db.query(`DELETE FROM eco_saludos WHERE id = $1`, [id]);
}

export async function saludoDeHoy(db, modulo) {
  const { rows } = await db.query(`SELECT eco_saludo($1) AS saludo`, [modulo]);
  return rows[0].saludo;
}
