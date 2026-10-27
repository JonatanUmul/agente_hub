import { estadoVigenciaSql, vigenteSql } from '../../lib/vigencia.js';

// SQL de eco_reglas_bot. `vigente` usa la misma condición que la vista eco_v_reglas_activas.
const SELECT_REGLA = `
  SELECT r.id, r.codigo, r.modulo, r.destino, r.categoria, r.titulo, r.regla, r.prioridad, r.activo,
         r.vigente_desde, r.vigente_hasta, r.actualizado_en, r.actualizado_por,
         r.actualizado_en::text AS version,
         ${vigenteSql('r')} AS vigente,
         ${estadoVigenciaSql('r')} AS estado_vigencia
  FROM eco_reglas_bot r`;

const fechaONull = (fecha) => fecha?.toISOString() ?? null;

function aRegla(fila) {
  return {
    id: fila.id,
    codigo: fila.codigo,
    modulo: fila.modulo,
    destino: fila.destino,
    categoria: fila.categoria,
    titulo: fila.titulo,
    regla: fila.regla,
    prioridad: fila.prioridad,
    activo: fila.activo,
    vigenteDesde: fechaONull(fila.vigente_desde),
    vigenteHasta: fechaONull(fila.vigente_hasta),
    vigente: fila.vigente,
    estadoVigencia: fila.estado_vigencia,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

// Mismo orden que eco_v_reglas_activas (prioridad menor = primero).
export async function listar(db) {
  const { rows } = await db.query(`${SELECT_REGLA} ORDER BY r.prioridad, r.id`);
  return rows.map(aRegla);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`${SELECT_REGLA} WHERE r.id = $1`, [id]);
  return rows[0] ? aRegla(rows[0]) : null;
}

export async function insertar(db, datos, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_reglas_bot
       (codigo, modulo, destino, categoria, titulo, regla, prioridad, activo, vigente_desde, vigente_hasta, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      datos.codigo,
      datos.modulo,
      datos.destino,
      datos.categoria,
      datos.titulo,
      datos.regla,
      datos.prioridad,
      datos.activo,
      datos.vigenteDesde,
      datos.vigenteHasta,
      actualizadoPor,
    ],
  );
  return rows[0].id;
}

export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(
    `SELECT modulo, destino, categoria, titulo, regla, prioridad, activo, vigente_desde, vigente_hasta,
            actualizado_en::text AS version
     FROM eco_reglas_bot WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    modulo: fila.modulo,
    destino: fila.destino,
    categoria: fila.categoria,
    titulo: fila.titulo,
    regla: fila.regla,
    prioridad: fila.prioridad,
    activo: fila.activo,
    vigenteDesde: fechaONull(fila.vigente_desde),
    vigenteHasta: fechaONull(fila.vigente_hasta),
    version: fila.version,
  };
}

export async function actualizar(db, id, datos, actualizadoPor) {
  await db.query(
    `UPDATE eco_reglas_bot
     SET modulo = $2, destino = $3, categoria = $4, titulo = $5, regla = $6, prioridad = $7,
         activo = $8, vigente_desde = $9, vigente_hasta = $10, actualizado_por = $11
     WHERE id = $1`,
    [
      id,
      datos.modulo,
      datos.destino,
      datos.categoria,
      datos.titulo,
      datos.regla,
      datos.prioridad,
      datos.activo,
      datos.vigenteDesde,
      datos.vigenteHasta,
      actualizadoPor,
    ],
  );
}
