import { aNumero } from '../../lib/numeros.js';
import { vigenteSql } from '../../lib/vigencia.js';

// descuento_vigente_pct sale de eco_v_catalogo (la misma vista que lee el bot), así no repetimos
// su lógica. La vista solo incluye productos activos: para los inactivos llega null.
// `version` es actualizado_en como texto con microsegundos: cambia en cada UPDATE (trigger *_upd).
const SELECT_PRODUCTO = `
  SELECT p.id, p.codigo, p.nombre, p.tipo, p.familia, p.capacidad_litros, p.colores, p.estado,
         p.precio_base, p.descuento_pct, p.woo_id, p.palabras_clave, p.orden, p.activo,
         p.actualizado_en, p.actualizado_por, p.actualizado_en::text AS version,
         v.descuento_vigente_pct,
         pa.id AS pauta_id, pa.codigo AS pauta_codigo, pa.nombre AS pauta_nombre,
         pa.descuento_pct AS pauta_descuento_pct,
         ${vigenteSql('pa')} AS pauta_vigente
  FROM eco_productos p
  LEFT JOIN eco_pautas pa ON pa.id = p.pauta_id
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
    pauta: fila.pauta_id
      ? {
          id: fila.pauta_id,
          codigo: fila.pauta_codigo,
          nombre: fila.pauta_nombre,
          descuentoPct: aNumero(fila.pauta_descuento_pct),
          vigente: fila.pauta_vigente,
        }
      : null,
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
    `SELECT precio_base, descuento_pct, estado, colores, palabras_clave, pauta_id, orden, activo,
            actualizado_en::text AS version
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
    pautaId: fila.pauta_id,
    orden: fila.orden,
    activo: fila.activo,
    version: fila.version,
  };
}

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
      datos.pautaId,
      datos.orden,
      datos.activo,
      actualizadoPor,
    ],
  );
}
