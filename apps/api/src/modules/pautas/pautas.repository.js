import { aNumero } from '../../lib/numeros.js';
import { estadoVigenciaSql, vigenteSql } from '../../lib/vigencia.js';

// Modelos y archivos de la pauta. Un archivo cuenta también si solo tiene pauta_id = la pauta
// (registros anteriores a eco_multimedia_pautas): el bot lo envía igual.
const IDS_ASOCIADOS = (alias) => `
  ARRAY(SELECT producto_id FROM eco_productos_pautas WHERE pauta_id = ${alias}.id ORDER BY 1) AS producto_ids,
  ARRAY(SELECT multimedia_id FROM eco_multimedia_pautas WHERE pauta_id = ${alias}.id
        UNION SELECT id FROM eco_multimedia WHERE pauta_id = ${alias}.id ORDER BY 1) AS multimedia_ids`;

const asociados = (fila) => ({
  aplicaTodos: fila.aplica_todos,
  productoIds: fila.producto_ids,
  multimediaIds: fila.multimedia_ids,
});

const SELECT_PAUTA = `
  SELECT pa.id, pa.codigo, pa.nombre, pa.mensaje_cliente, pa.descuento_pct, pa.palabras_clave,
         pa.vigente_desde, pa.vigente_hasta, pa.activo, pa.aplica_todos, pa.actualizado_en, pa.actualizado_por,
         ${IDS_ASOCIADOS('pa')},
         pa.actualizado_en::text AS version,
         ${vigenteSql('pa')} AS vigente,
         ${estadoVigenciaSql('pa')} AS estado_vigencia,
         (SELECT count(*)::int FROM eco_productos_pautas pp JOIN eco_productos p ON p.id = pp.producto_id
           WHERE pp.pauta_id = pa.id AND p.activo) AS productos_activos,
         (SELECT count(*)::int FROM eco_multimedia_pautas mp JOIN eco_multimedia m ON m.id = mp.multimedia_id
           WHERE mp.pauta_id = pa.id AND m.activo) AS archivos_activos
  FROM eco_pautas pa`;

const fechaONull = (fecha) => fecha?.toISOString() ?? null;

function aPauta(fila) {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    mensajeCliente: fila.mensaje_cliente,
    descuentoPct: aNumero(fila.descuento_pct),
    palabrasClave: fila.palabras_clave,
    vigenteDesde: fechaONull(fila.vigente_desde),
    vigenteHasta: fechaONull(fila.vigente_hasta),
    activo: fila.activo,
    vigente: fila.vigente,
    estadoVigencia: fila.estado_vigencia,
    ...asociados(fila),
    productosActivos: fila.productos_activos,
    archivosActivos: fila.archivos_activos,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

export async function listar(db) {
  const { rows } = await db.query(
    `${SELECT_PAUTA} ORDER BY pa.activo DESC, pa.vigente_hasta DESC NULLS FIRST, pa.id DESC`,
  );
  return rows.map(aPauta);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`${SELECT_PAUTA} WHERE pa.id = $1`, [id]);
  return rows[0] ? aPauta(rows[0]) : null;
}

export async function listarResumen(db) {
  const { rows } = await db.query(
    `SELECT pa.id, pa.codigo, pa.nombre, pa.descuento_pct, pa.activo, pa.aplica_todos,
            ${vigenteSql('pa')} AS vigente, ${IDS_ASOCIADOS('pa')}
     FROM eco_pautas pa
     ORDER BY pa.activo DESC, pa.nombre, pa.id`,
  );
  return rows.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    descuentoPct: aNumero(fila.descuento_pct),
    activo: fila.activo,
    vigente: fila.vigente,
    ...asociados(fila),
  }));
}

export async function insertar(db, datos, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_pautas
       (codigo, nombre, mensaje_cliente, descuento_pct, palabras_clave, vigente_desde, vigente_hasta, activo,
        aplica_todos, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      datos.codigo,
      datos.nombre,
      datos.mensajeCliente,
      datos.descuentoPct,
      datos.palabrasClave,
      datos.vigenteDesde,
      datos.vigenteHasta,
      datos.activo,
      datos.aplicaTodos,
      actualizadoPor,
    ],
  );
  await sincronizarAsociados(db, rows[0].id, datos, actualizadoPor);
  return rows[0].id;
}

// Campos editables + versión, bloqueando la fila hasta el fin de la transacción.
// Las fechas se devuelven en ISO para compararlas con lo que envía el cliente.
export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(
    `SELECT pa.nombre, pa.mensaje_cliente, pa.descuento_pct, pa.palabras_clave, pa.vigente_desde,
            pa.vigente_hasta, pa.activo, pa.aplica_todos, pa.actualizado_en::text AS version,
            ${IDS_ASOCIADOS('pa')}
     FROM eco_pautas pa WHERE pa.id = $1 FOR UPDATE`,
    [id],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    nombre: fila.nombre,
    mensajeCliente: fila.mensaje_cliente,
    descuentoPct: aNumero(fila.descuento_pct),
    palabrasClave: fila.palabras_clave,
    vigenteDesde: fechaONull(fila.vigente_desde),
    vigenteHasta: fechaONull(fila.vigente_hasta),
    activo: fila.activo,
    ...asociados(fila),
    version: fila.version,
  };
}

export async function actualizar(db, id, datos, actualizadoPor) {
  await db.query(
    `UPDATE eco_pautas
     SET nombre = $2, mensaje_cliente = $3, descuento_pct = $4, palabras_clave = $5,
         vigente_desde = $6, vigente_hasta = $7, activo = $8, aplica_todos = $9, actualizado_por = $10
     WHERE id = $1`,
    [
      id,
      datos.nombre,
      datos.mensajeCliente,
      datos.descuentoPct,
      datos.palabrasClave,
      datos.vigenteDesde,
      datos.vigenteHasta,
      datos.activo,
      datos.aplicaTodos,
      actualizadoPor,
    ],
  );
  await sincronizarAsociados(db, id, datos, actualizadoPor);
}

// Deja los modelos y archivos de la pauta como `productoIds` / `multimediaIds`: borra solo los quitados
// e inserta los nuevos. Con `aplicaTodos` los modelos no se tocan (vuelven si se apaga).
async function sincronizarAsociados(db, pautaId, datos, actualizadoPor) {
  if (!datos.aplicaTodos)
    await sincronizarProductos(db, pautaId, datos.productoIds, actualizadoPor);
  await sincronizarArchivos(db, pautaId, datos.multimediaIds, actualizadoPor);
}

// eco_productos.pauta_id (anterior a docs/sql/002) guarda la primera pauta del producto, igual que al
// editarlo desde Productos. Solo se actualizan los productos cuyo valor cambia.
async function sincronizarProductos(db, pautaId, ids, actualizadoPor) {
  await db.query(
    `DELETE FROM eco_productos_pautas WHERE pauta_id = $1 AND NOT (producto_id = ANY($2::int[]))`,
    [pautaId, ids],
  );
  await db.query(
    `INSERT INTO eco_productos_pautas (producto_id, pauta_id, actualizado_por)
     SELECT unnest($2::int[]), $1, $3
     ON CONFLICT DO NOTHING`,
    [pautaId, ids, actualizadoPor],
  );
  // Afectados: los agregados y los quitados cuya primera pauta era esta.
  const primera = `(SELECT min(pp.pauta_id) FROM eco_productos_pautas pp WHERE pp.producto_id = p.id)`;
  await db.query(
    `UPDATE eco_productos p SET pauta_id = ${primera}, actualizado_por = $3
     WHERE (p.pauta_id = $1 OR p.id = ANY($2::int[])) AND p.pauta_id IS DISTINCT FROM ${primera}`,
    [pautaId, ids, actualizadoPor],
  );
}

// Pauta principal del archivo (eco_multimedia.pauta_id, la que usa n8n): misma regla que
// `principalTrasCambio` de @ecofiltro/shared.
async function sincronizarArchivos(db, pautaId, ids, actualizadoPor) {
  await db.query(
    `DELETE FROM eco_multimedia_pautas WHERE pauta_id = $1 AND NOT (multimedia_id = ANY($2::int[]))`,
    [pautaId, ids],
  );
  await db.query(
    `INSERT INTO eco_multimedia_pautas (multimedia_id, pauta_id, actualizado_por)
     SELECT unnest($2::int[]), $1, $3
     ON CONFLICT DO NOTHING`,
    [pautaId, ids, actualizadoPor],
  );
  await db.query(
    `UPDATE eco_multimedia SET pauta_id = $1, actualizado_por = $3
     WHERE id = ANY($2::int[]) AND pauta_id IS NULL`,
    [pautaId, ids, actualizadoPor],
  );
  await db.query(
    `UPDATE eco_multimedia m
     SET pauta_id = (SELECT min(mp.pauta_id) FROM eco_multimedia_pautas mp WHERE mp.multimedia_id = m.id),
         actualizado_por = $3
     WHERE m.pauta_id = $1 AND NOT (m.id = ANY($2::int[]))`,
    [pautaId, ids, actualizadoPor],
  );
}

// Ids nuevos para la pauta (aún no asociados) que no existen o están inactivos.
export async function productosNoAsignables(db, pautaId, ids) {
  const { rows } = await db.query(
    `SELECT u.id FROM unnest($2::int[]) AS u(id)
     WHERE NOT EXISTS (SELECT 1 FROM eco_productos_pautas pp WHERE pp.pauta_id = $1 AND pp.producto_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM eco_productos p WHERE p.id = u.id AND p.activo)
     ORDER BY u.id`,
    [pautaId, ids],
  );
  return rows.map((f) => f.id);
}

export async function archivosNoAsignables(db, pautaId, ids) {
  const { rows } = await db.query(
    `SELECT u.id FROM unnest($2::int[]) AS u(id)
     WHERE NOT EXISTS (SELECT 1 FROM eco_multimedia_pautas mp WHERE mp.pauta_id = $1 AND mp.multimedia_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM eco_multimedia m WHERE m.id = u.id AND (m.activo OR m.pauta_id = $1))
     ORDER BY u.id`,
    [pautaId, ids],
  );
  return rows.map((f) => f.id);
}
