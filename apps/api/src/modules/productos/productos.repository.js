import { aNumero } from '../../lib/numeros.js';
import { vigenteSql } from '../../lib/vigencia.js';

// Ficha del producto (docs/sql: columnas opcionales que el bot recibe en eco_contexto()).
const COLUMNAS_FICHA = (alias) =>
  [
    'descripcion_corta',
    'descripcion',
    'caracteristicas',
    'material',
    'capacidad_texto',
    'capacidad_purificador_litros',
    'tasa_filtrado',
    'ancho_cm',
    'alto_cm',
    'largo_cm',
    'peso_lb',
    'compatible_con',
    'url_web',
  ]
    .map((columna) => `${alias}.${columna}`)
    .join(', ');

// La lista vacía se lee igual que NULL: la columna admite ambos.
const aFicha = (fila) => ({
  descripcionCorta: fila.descripcion_corta,
  descripcion: fila.descripcion,
  caracteristicas: fila.caracteristicas ?? [],
  material: fila.material,
  capacidadTexto: fila.capacidad_texto,
  capacidadPurificadorLitros: aNumero(fila.capacidad_purificador_litros),
  tasaFiltrado: fila.tasa_filtrado,
  anchoCm: aNumero(fila.ancho_cm),
  altoCm: aNumero(fila.alto_cm),
  largoCm: aNumero(fila.largo_cm),
  pesoLb: aNumero(fila.peso_lb),
  compatibleCon: fila.compatible_con,
  urlWeb: fila.url_web,
});

// descuento_vigente_pct sale de eco_v_catalogo (la misma vista que lee el bot), así no repetimos
// su lógica. La vista solo incluye productos activos: para los inactivos llega null.
// `pautas` = todas las pautas asociadas (eco_productos_pautas), cada una con su vigencia.
// `version` es actualizado_en como texto con microsegundos: cambia en cada UPDATE (trigger *_upd).
const SELECT_PRODUCTO = `
  SELECT p.id, p.codigo, p.nombre, p.tipo, p.familia, p.capacidad_litros, p.colores, p.estado,
         p.precio_base, p.descuento_pct, p.woo_id, p.palabras_clave, p.orden, p.activo,
         ${COLUMNAS_FICHA('p')},
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
    ...aFicha(fila),
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
    `SELECT p.tipo, p.precio_base, p.descuento_pct, p.estado, p.colores, p.palabras_clave, p.orden,
            p.activo, ${COLUMNAS_FICHA('p')}, p.actualizado_en::text AS version,
            ARRAY(SELECT pauta_id FROM eco_productos_pautas WHERE producto_id = $1 ORDER BY pauta_id) AS pauta_ids
     FROM eco_productos p WHERE p.id = $1 FOR UPDATE`,
    [id],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    // El tipo no se edita; el service lo usa para validar qué campos de la ficha aplican.
    tipo: fila.tipo,
    precioBase: aNumero(fila.precio_base),
    descuentoPct: aNumero(fila.descuento_pct),
    estado: fila.estado,
    colores: fila.colores,
    palabrasClave: fila.palabras_clave,
    pautaIds: fila.pauta_ids,
    orden: fila.orden,
    activo: fila.activo,
    ...aFicha(fila),
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
         pauta_id = $7, orden = $8, activo = $9, actualizado_por = $10,
         descripcion_corta = $11, descripcion = $12, caracteristicas = $13, material = $14,
         capacidad_texto = $15, capacidad_purificador_litros = $16, tasa_filtrado = $17,
         ancho_cm = $18, alto_cm = $19, largo_cm = $20, peso_lb = $21, compatible_con = $22,
         url_web = $23
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
      datos.descripcionCorta,
      datos.descripcion,
      // Sin características se guarda NULL: así es seguro que el campo no llega al bot.
      datos.caracteristicas.length ? datos.caracteristicas : null,
      datos.material,
      datos.capacidadTexto,
      datos.capacidadPurificadorLitros,
      datos.tasaFiltrado,
      datos.anchoCm,
      datos.altoCm,
      datos.largoCm,
      datos.pesoLb,
      datos.compatibleCon,
      datos.urlWeb,
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
