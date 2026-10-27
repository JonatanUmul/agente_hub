// SQL de eco_multimedia (imágenes, videos y artes de promociones con su ID de archivo de HubSpot).

// `pautas` = todas las pautas en cuyas imágenes aparece el archivo (eco_multimedia_pautas).
const SELECT_ARCHIVO = `
  SELECT m.id, m.tipo, m.hubspot_file_id, m.descripcion, m.color, m.tema, m.orden, m.activo,
         m.actualizado_en, m.actualizado_por, m.actualizado_en::text AS version,
         p.id AS producto_id, p.codigo AS producto_codigo, p.nombre AS producto_nombre,
         COALESCE((
           SELECT json_agg(json_build_object('id', pa.id, 'codigo', pa.codigo, 'nombre', pa.nombre)
                  ORDER BY pa.nombre, pa.id)
           FROM eco_multimedia_pautas mp
           JOIN eco_pautas pa ON pa.id = mp.pauta_id
           WHERE mp.multimedia_id = m.id
         ), '[]') AS pautas
  FROM eco_multimedia m
  LEFT JOIN eco_productos p ON p.id = m.producto_id`;

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
    pautas: fila.pautas,
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
      datos.pautaIds[0] ?? null,
      datos.orden,
      datos.activo,
      actualizadoPor,
    ],
  );
  await sincronizarPautas(db, rows[0].id, datos.pautaIds, actualizadoPor);
  return rows[0].id;
}

// Campos editables + versión, bloqueando la fila hasta el fin de la transacción.
export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(
    `SELECT descripcion, producto_id, color, tema, orden, activo, actualizado_en::text AS version,
            ARRAY(SELECT pauta_id FROM eco_multimedia_pautas WHERE multimedia_id = $1 ORDER BY pauta_id) AS pauta_ids
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
    pautaIds: fila.pauta_ids,
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
      datos.pautaIds[0] ?? null,
      datos.orden,
      datos.activo,
      actualizadoPor,
    ],
  );
  await sincronizarPautas(db, id, datos.pautaIds, actualizadoPor);
}

// Deja las pautas del archivo exactamente como `pautaIds`. eco_multimedia.pauta_id (columna anterior a
// docs/sql/003) guarda la primera por compatibilidad; la fuente de verdad es eco_multimedia_pautas.
async function sincronizarPautas(db, multimediaId, pautaIds, actualizadoPor) {
  await db.query(
    `DELETE FROM eco_multimedia_pautas WHERE multimedia_id = $1 AND NOT (pauta_id = ANY($2::int[]))`,
    [multimediaId, pautaIds],
  );
  await db.query(
    `INSERT INTO eco_multimedia_pautas (multimedia_id, pauta_id, actualizado_por)
     SELECT $1, unnest($2::int[]), $3
     ON CONFLICT DO NOTHING`,
    [multimediaId, pautaIds, actualizadoPor],
  );
}
