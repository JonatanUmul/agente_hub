// SQL de eco_frases_cierre. `version` = actualizado_en con microsegundos: cambia en cada UPDATE (trigger *_upd).
const SELECT_FRASE = `
  SELECT id, modulo, situacion, frase, activo, orden, actualizado_en, actualizado_por,
         actualizado_en::text AS version
  FROM eco_frases_cierre`;

function aFrase(fila) {
  return {
    id: fila.id,
    modulo: fila.modulo,
    situacion: fila.situacion,
    frase: fila.frase,
    activo: fila.activo,
    orden: fila.orden,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

// Mismo orden en que eco_contexto() entrega las frases al bot. Filtros opcionales (null = todos).
export async function listar(db, { modulo = null, situacion = null, activo = null } = {}) {
  const { rows } = await db.query(
    `${SELECT_FRASE}
     WHERE ($1::text IS NULL OR modulo = $1)
       AND ($2::text IS NULL OR situacion = $2)
       AND ($3::boolean IS NULL OR activo = $3)
     ORDER BY orden, id`,
    [modulo, situacion, activo],
  );
  return rows.map(aFrase);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`${SELECT_FRASE} WHERE id = $1`, [id]);
  return rows[0] ? aFrase(rows[0]) : null;
}

// Una frase nueva va al final de su grupo (módulo + situación).
export async function insertar(db, datos, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_frases_cierre (modulo, situacion, frase, activo, orden, actualizado_por)
     VALUES ($1, $2, $3, $4,
             (SELECT COALESCE(max(orden), 0) + 10 FROM eco_frases_cierre WHERE modulo = $1 AND situacion = $2),
             $5)
     RETURNING id`,
    [datos.modulo, datos.situacion, datos.frase, datos.activo, actualizadoPor],
  );
  return rows[0].id;
}

export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(
    `SELECT modulo, situacion, frase, activo, actualizado_en::text AS version
     FROM eco_frases_cierre WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

export async function actualizar(db, id, datos, actualizadoPor) {
  await db.query(
    `UPDATE eco_frases_cierre
     SET modulo = $2, situacion = $3, frase = $4, activo = $5, actualizado_por = $6
     WHERE id = $1`,
    [id, datos.modulo, datos.situacion, datos.frase, datos.activo, actualizadoPor],
  );
}

// El trigger de auditoría guarda en un DELETE la fila anterior. Primero se anota quién borra, para que
// el historial lo atribuya a esa persona y no a quien editó la frase antes.
export async function eliminar(db, id, actualizadoPor) {
  await db.query(`UPDATE eco_frases_cierre SET actualizado_por = $2 WHERE id = $1`, [
    id,
    actualizadoPor,
  ]);
  await db.query(`DELETE FROM eco_frases_cierre WHERE id = $1`, [id]);
}

// Grupo (módulo + situación) de cada frase, bloqueando las filas mientras se reordenan.
export async function gruposBloqueando(db, ids) {
  const { rows } = await db.query(
    `SELECT id, modulo, situacion, orden FROM eco_frases_cierre WHERE id = ANY($1::int[]) FOR UPDATE`,
    [ids],
  );
  return rows;
}

export async function cambiarOrden(db, id, orden, actualizadoPor) {
  await db.query(`UPDATE eco_frases_cierre SET orden = $2, actualizado_por = $3 WHERE id = $1`, [
    id,
    orden,
    actualizadoPor,
  ]);
}
