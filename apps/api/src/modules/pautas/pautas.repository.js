import { aNumero } from '../../lib/numeros.js';
import { estadoVigenciaSql, vigenteSql } from '../../lib/vigencia.js';

const SELECT_PAUTA = `
  SELECT pa.id, pa.codigo, pa.nombre, pa.mensaje_cliente, pa.descuento_pct, pa.palabras_clave,
         pa.vigente_desde, pa.vigente_hasta, pa.activo, pa.actualizado_en, pa.actualizado_por,
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
    `SELECT pa.id, pa.codigo, pa.nombre, pa.descuento_pct, pa.activo, ${vigenteSql('pa')} AS vigente
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
  }));
}

export async function insertar(db, datos, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_pautas
       (codigo, nombre, mensaje_cliente, descuento_pct, palabras_clave, vigente_desde, vigente_hasta, activo, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      actualizadoPor,
    ],
  );
  return rows[0].id;
}

// Campos editables + versión, bloqueando la fila hasta el fin de la transacción.
// Las fechas se devuelven en ISO para compararlas con lo que envía el cliente.
export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(
    `SELECT nombre, mensaje_cliente, descuento_pct, palabras_clave, vigente_desde, vigente_hasta, activo,
            actualizado_en::text AS version
     FROM eco_pautas WHERE id = $1 FOR UPDATE`,
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
    version: fila.version,
  };
}

export async function actualizar(db, id, datos, actualizadoPor) {
  await db.query(
    `UPDATE eco_pautas
     SET nombre = $2, mensaje_cliente = $3, descuento_pct = $4, palabras_clave = $5,
         vigente_desde = $6, vigente_hasta = $7, activo = $8, actualizado_por = $9
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
      actualizadoPor,
    ],
  );
}
