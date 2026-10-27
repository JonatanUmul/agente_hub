// SQL de eco_multimedia (imágenes, videos y artes de promociones con su ID de archivo de HubSpot).

const SELECT_ARCHIVO = `
  SELECT m.id, m.tipo, m.hubspot_file_id, m.descripcion, m.color, m.tema, m.orden, m.activo,
         m.actualizado_en, m.actualizado_por, m.actualizado_en::text AS version,
         p.id AS producto_id, p.codigo AS producto_codigo, p.nombre AS producto_nombre,
         pa.id AS pauta_id, pa.codigo AS pauta_codigo, pa.nombre AS pauta_nombre
  FROM eco_multimedia m
  LEFT JOIN eco_productos p ON p.id = m.producto_id
  LEFT JOIN eco_pautas pa ON pa.id = m.pauta_id`;

function aArchivo(fila) {
  return {
    id: fila.id,
    tipo: fila.tipo,
    hubspotFileId: fila.hubspot_file_id,
    descripcion: fila.descripcion,
    producto: fila.producto_id
      ? { id: fila.producto_id, codigo: fila.producto_codigo, nombre: fila.producto_nombre }
      : null,
    color: fila.color,
    tema: fila.tema,
    pauta: fila.pauta_id
      ? { id: fila.pauta_id, codigo: fila.pauta_codigo, nombre: fila.pauta_nombre }
      : null,
    orden: fila.orden,
    activo: fila.activo,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

// Mismo orden que usa eco_contexto() para la lista de multimedia.
export async function listar(db) {
  const { rows } = await db.query(`${SELECT_ARCHIVO} ORDER BY m.tipo, m.orden, m.id`);
  return rows.map(aArchivo);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`${SELECT_ARCHIVO} WHERE m.id = $1`, [id]);
  return rows[0] ? aArchivo(rows[0]) : null;
}

export async function insertar(db, datos, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_multimedia
       (tipo, hubspot_file_id, descripcion, producto_id, color, tema, pauta_id, orden, activo, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      datos.tipo,
      datos.hubspotFileId,
      datos.descripcion,
      datos.productoId,
      datos.color,
      datos.tema,
      datos.pautaId,
      datos.orden,
      datos.activo,
      actualizadoPor,
    ],
  );
  return rows[0].id;
}

// Campos editables + versión, bloqueando la fila hasta el fin de la transacción.
export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(
    `SELECT descripcion, producto_id, color, tema, pauta_id, orden, activo, actualizado_en::text AS version
     FROM eco_multimedia WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    descripcion: fila.descripcion,
    productoId: fila.producto_id,
    color: fila.color,
    tema: fila.tema,
    pautaId: fila.pauta_id,
    orden: fila.orden,
    activo: fila.activo,
    version: fila.version,
  };
}

export async function actualizar(db, id, datos, actualizadoPor) {
  await db.query(
    `UPDATE eco_multimedia
     SET descripcion = $2, producto_id = $3, color = $4, tema = $5, pauta_id = $6, orden = $7,
         activo = $8, actualizado_por = $9
     WHERE id = $1`,
    [
      id,
      datos.descripcion,
      datos.productoId,
      datos.color,
      datos.tema,
      datos.pautaId,
      datos.orden,
      datos.activo,
      actualizadoPor,
    ],
  );
}
