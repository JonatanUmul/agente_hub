// SQL de eco_mensajes_tipos (solo lectura) y eco_mensajes.
const SELECT_VERSION = `
  SELECT id, clave, texto, activo, orden, actualizado_en, actualizado_por, actualizado_en::text AS version
  FROM eco_mensajes`;

function aVersion(fila) {
  return {
    id: fila.id,
    clave: fila.clave,
    texto: fila.texto,
    activo: fila.activo,
    orden: fila.orden,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

export async function listarTipos(db) {
  const { rows } = await db.query(
    `SELECT clave, categoria, titulo, descripcion, comodines, varias, orden
     FROM eco_mensajes_tipos ORDER BY orden, clave`,
  );
  return rows.map((f) => ({ ...f, comodines: f.comodines ?? [] }));
}

export async function obtenerTipo(db, clave) {
  const { rows } = await db.query(
    `SELECT clave, categoria, titulo, descripcion, comodines, varias, orden
     FROM eco_mensajes_tipos WHERE clave = $1`,
    [clave],
  );
  return rows[0] ? { ...rows[0], comodines: rows[0].comodines ?? [] } : null;
}

// Mismo orden en que eco_contexto() entrega los textos de cada clave.
export async function listarVersiones(db, clave = null) {
  const { rows } = await db.query(
    `${SELECT_VERSION} WHERE ($1::text IS NULL OR clave = $1) ORDER BY clave, orden, id`,
    [clave],
  );
  return rows.map(aVersion);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`${SELECT_VERSION} WHERE id = $1`, [id]);
  return rows[0] ? aVersion(rows[0]) : null;
}

// Versiones de una clave bloqueadas mientras se decide (para no dejarla sin texto entre dos personas).
export async function versionesBloqueando(db, clave) {
  const { rows } = await db.query(
    `${SELECT_VERSION} WHERE clave = $1 ORDER BY orden, id FOR UPDATE`,
    [clave],
  );
  return rows.map(aVersion);
}

export async function insertar(db, { clave, texto, activo }, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_mensajes (clave, texto, activo, orden, actualizado_por)
     VALUES ($1, $2, $3,
             (SELECT COALESCE(max(orden), 0) + 10 FROM eco_mensajes WHERE clave = $1), $4)
     RETURNING id`,
    [clave, texto, activo, actualizadoPor],
  );
  return rows[0].id;
}

export async function actualizar(db, id, { texto, activo }, actualizadoPor) {
  await db.query(
    `UPDATE eco_mensajes SET texto = $2, activo = $3, actualizado_por = $4 WHERE id = $1`,
    [id, texto, activo, actualizadoPor],
  );
}

export async function cambiarOrden(db, id, orden, actualizadoPor) {
  await db.query(`UPDATE eco_mensajes SET orden = $2, actualizado_por = $3 WHERE id = $1`, [
    id,
    orden,
    actualizadoPor,
  ]);
}

// Se anota quién borra antes del DELETE, para que el historial lo atribuya bien.
export async function eliminar(db, id, actualizadoPor) {
  await db.query(`UPDATE eco_mensajes SET actualizado_por = $2 WHERE id = $1`, [
    id,
    actualizadoPor,
  ]);
  await db.query(`DELETE FROM eco_mensajes WHERE id = $1`, [id]);
}

export async function gruposBloqueando(db, ids) {
  const { rows } = await db.query(
    `SELECT id, clave, orden FROM eco_mensajes WHERE id = ANY($1::int[]) FOR UPDATE`,
    [ids],
  );
  return rows;
}
