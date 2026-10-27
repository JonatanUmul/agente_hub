import { aNumero } from '../../lib/numeros.js';
import { vigenteSql } from '../../lib/vigencia.js';

// descuento_vigente_pct sale de eco_v_catalogo (la misma vista que lee el bot), así no repetimos
// su lógica. La vista solo incluye productos activos: para los inactivos llega null.
// `pautas` = todas las pautas asociadas (eco_productos_pautas), cada una con su vigencia.
// `version` es actualizado_en como texto con microsegundos: cambia en cada UPDATE (trigger *_upd).
const SELECT_PRODUCTO = `
  SELECT p.id, p.codigo, p.nombre, p.tipo, p.familia, p.capacidad_litros, p.colores, p.estado,
         p.precio_base, p.descuento_pct, p.woo_id, p.palabras_clave, p.orden, p.activo,
         p.actualizado_en, p.actualizado_por, p.actualizado_en::text AS version,
         v.descuento_vigente_pct,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'id', pa.id, 'codigo', pa.codigo, 'nombre', pa.nombre,
                    'descuentoPct', pa.descuento_pct, 'vigente', ${vigenteSql('pa')})
                  ORDER BY pa.nombre, pa.id)
           FROM eco_productos_pautas pp
           JOIN eco_pautas pa ON pa.id = pp.pauta_id
           WHERE pp.producto_id = p.id
         ), '[]') AS pautas
  FROM eco_productos p
  LEFT JOIN eco_v_catalogo v ON v.id = p.id`;

function aProducto(fila) {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    tipo: fila.tipo,
    familia: fila.familia,
    capacidadLitros: aNumero(fila.capacidad_litros),
    colores: fila.colores,
    estado: fila.estado,
    precioBase: aNumero(fila.precio_base),
    descuentoPct: aNumero(fila.descuento_pct),
    // json_agg entrega numeric como número JSON: no hace falta convertir.
    pautas: fila.pautas,
    descuentoVigentePct: aNumero(fila.descuento_vigente_pct),
    wooId: fila.woo_id,
    palabrasClave: fila.palabras_clave,
    orden: fila.orden,
    activo: fila.activo,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

// Mismo orden que usa eco_contexto() para el catálogo.
export async function listar(db) {
  const { rows } = await db.query(`${SELECT_PRODUCTO} ORDER BY p.orden, p.id`);
  return rows.map(aProducto);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`${SELECT_PRODUCTO} WHERE p.id = $1`, [id]);
  return rows[0] ? aProducto(rows[0]) : null;
}

// Solo los campos editables + versión, bloqueando la fila hasta el fin de la transacción
// para que nadie más la cambie entre la verificación de versión y el UPDATE.
export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(
    `SELECT precio_base, descuento_pct, estado, colores, palabras_clave, orden, activo,
            actualizado_en::text AS version,
            ARRAY(SELECT pauta_id FROM eco_productos_pautas WHERE producto_id = $1 ORDER BY pauta_id) AS pauta_ids
     FROM eco_productos WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    precioBase: aNumero(fila.precio_base),
    descuentoPct: aNumero(fila.descuento_pct),
    estado: fila.estado,
    colores: fila.colores,
    palabrasClave: fila.palabras_clave,
    pautaIds: fila.pauta_ids,
    orden: fila.orden,
    activo: fila.activo,
    version: fila.version,
  };
}

// Actualiza el producto y deja sus pautas exactamente como `datos.pautaIds`.
// eco_productos.pauta_id (columna anterior a docs/sql/002) se mantiene con la primera pauta para que
// nada que todavía lo lea quede desactualizado; la fuente de verdad es eco_productos_pautas.
export async function actualizar(db, id, datos, actualizadoPor) {
  await db.query(
    `UPDATE eco_productos
     SET precio_base = $2, descuento_pct = $3, estado = $4, colores = $5, palabras_clave = $6,
         pauta_id = $7, orden = $8, activo = $9, actualizado_por = $10
     WHERE id = $1`,
    [
      id,
      datos.precioBase,
      datos.descuentoPct,
      datos.estado,
      datos.colores,
      datos.palabrasClave,
      datos.pautaIds[0] ?? null,
      datos.orden,
      datos.activo,
      actualizadoPor,
    ],
  );
  await db.query(
    `DELETE FROM eco_productos_pautas WHERE producto_id = $1 AND NOT (pauta_id = ANY($2::int[]))`,
    [id, datos.pautaIds],
  );
  await db.query(
    `INSERT INTO eco_productos_pautas (producto_id, pauta_id, actualizado_por)
     SELECT $1, unnest($2::int[]), $3
     ON CONFLICT DO NOTHING`,
    [id, datos.pautaIds, actualizadoPor],
  );
}
