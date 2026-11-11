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
    'pistas_visuales',
    'fotos_referencia',
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
  ...aVision(fila),
});

// Identificación por imagen. fotos_referencia es jsonb [{ url, color }]; NULL o algo raro se lee como [].
function aVision(fila) {
  const fotos = Array.isArray(fila.fotos_referencia) ? fila.fotos_referencia : [];
  return {
    pistasVisuales: fila.pistas_visuales,
    fotosReferencia: fotos.map((f) => ({ url: String(f?.url ?? ''), color: f?.color ?? null })),
  };
}

// descuento_vigente_pct sale de eco_v_catalogo (la misma vista que lee el bot), así no repetimos
// su lógica. La vista solo incluye productos activos: para los inactivos llega null.
// `pautas` = todas las pautas asociadas (eco_productos_pautas), cada una con su vigencia.
// `version` es actualizado_en como texto con microsegundos: cambia en cada UPDATE (trigger *_upd).
const SELECT_PRODUCTO = `
  SELECT p.id, p.codigo, p.nombre, p.tipo, p.familia, p.variante, p.nombre_corto,
         p.capacidad_litros, p.colores, p.estado,
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
         ), '[]') AS pautas,
         ARRAY(
           SELECT DISTINCT m.color FROM eco_multimedia m
           WHERE m.producto_id = p.id AND m.tipo = 'imagen' AND m.activo AND m.color IS NOT NULL
         ) AS colores_con_foto
  FROM eco_productos p
  LEFT JOIN eco_v_catalogo v ON v.id = p.id`;

function aProducto(fila) {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    tipo: fila.tipo,
    familia: fila.familia,
    variante: fila.variante,
    nombreCorto: fila.nombre_corto,
    capacidadLitros: aNumero(fila.capacidad_litros),
    colores: fila.colores,
    estado: fila.estado,
    precioBase: aNumero(fila.precio_base),
    descuentoPct: aNumero(fila.descuento_pct),
    // json_agg entrega numeric como número JSON: no hace falta convertir.
    pautas: fila.pautas,
    descuentoVigentePct: aNumero(fila.descuento_vigente_pct),
    coloresConFoto: fila.colores_con_foto,
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
    `SELECT p.codigo, p.variante, p.nombre_corto, p.tipo, p.precio_base, p.descuento_pct, p.estado, p.colores, p.palabras_clave, p.orden,
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
    codigo: fila.codigo,
    variante: fila.variante,
    nombreCorto: fila.nombre_corto,
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

// Valores de las columnas editables, en el orden de COLUMNAS_EDITABLES (crear y actualizar los comparten).
const COLUMNAS_EDITABLES = [
  'codigo',
  'variante',
  'nombre_corto',
  'precio_base',
  'descuento_pct',
  'estado',
  'colores',
  'palabras_clave',
  'pauta_id',
  'orden',
  'activo',
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
  'pistas_visuales',
];

// eco_productos.pauta_id (columna anterior a docs/sql/002) se mantiene con la primera pauta para que
// nada que todavía lo lea quede desactualizado; la fuente de verdad es eco_productos_pautas.
const valoresEditables = (datos) => [
  datos.codigo,
  datos.variante,
  datos.nombreCorto,
  datos.precioBase,
  datos.descuentoPct,
  datos.estado,
  datos.colores,
  datos.palabrasClave,
  datos.pautaIds[0] ?? null,
  datos.orden,
  datos.activo,
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
  datos.pistasVisuales,
];

// Producto nuevo; devuelve su id. creado_en y actualizado_en los pone la base (DEFAULT now()).
// Sin fotos de referencia se guarda NULL, igual que en los productos que nunca las tuvieron.
export async function crear(db, datos, actualizadoPor) {
  const columnas = [
    ...COLUMNAS_EDITABLES,
    'nombre',
    'tipo',
    'familia',
    'capacidad_litros',
    'fotos_referencia',
    'actualizado_por',
  ];
  const valores = [
    ...valoresEditables(datos),
    datos.nombre,
    datos.tipo,
    datos.familia,
    datos.capacidadLitros,
    datos.fotosReferencia.length ? JSON.stringify(datos.fotosReferencia) : null,
    actualizadoPor,
  ];
  const { rows } = await db.query(
    `INSERT INTO eco_productos (${columnas.join(', ')})
     VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING id`,
    valores,
  );
  return rows[0].id;
}

// Actualiza el producto y deja sus pautas exactamente como `datos.pautaIds`.
export async function actualizar(db, id, datos, actualizadoPor) {
  const valores = valoresEditables(datos);
  const asignaciones = COLUMNAS_EDITABLES.map((columna, i) => `${columna} = $${i + 2}`);
  const n = valores.length + 2;
  await db.query(
    `UPDATE eco_productos
     SET ${asignaciones.join(', ')}, actualizado_por = $${n},
         -- Sin fotos se conserva NULL si ya lo era: así guardar otro campo no anota un cambio falso.
         fotos_referencia = CASE WHEN fotos_referencia IS NULL AND $${n + 1}::jsonb = '[]'::jsonb
                                 THEN NULL ELSE $${n + 1}::jsonb END
     WHERE id = $1`,
    [id, ...valores, actualizadoPor, JSON.stringify(datos.fotosReferencia)],
  );
  await guardarPautas(db, id, datos.pautaIds, actualizadoPor);
}

export async function guardarPautas(db, id, pautaIds, actualizadoPor) {
  await db.query(
    `DELETE FROM eco_productos_pautas WHERE producto_id = $1 AND NOT (pauta_id = ANY($2::int[]))`,
    [id, pautaIds],
  );
  await db.query(
    `INSERT INTO eco_productos_pautas (producto_id, pauta_id, actualizado_por)
     SELECT $1, unnest($2::int[]), $3
     ON CONFLICT DO NOTHING`,
    [id, pautaIds, actualizadoPor],
  );
}

// Otro producto (activo o no) con el mismo ItemCode sin importar mayúsculas.
export async function buscarCodigoEnUso(db, codigo, excluirId) {
  const { rows } = await db.query(
    `SELECT id, codigo, nombre, activo FROM eco_productos
     WHERE upper(codigo) = upper($1) AND id IS DISTINCT FROM $2
     ORDER BY id LIMIT 1`,
    [codigo, excluirId],
  );
  return rows[0] ?? null;
}

// Filas que cuelgan del producto por producto_id (no dependen del ItemCode).
export async function contarDependencias(db, id) {
  const { rows } = await db.query(
    `SELECT
       (SELECT count(*) FROM eco_multimedia WHERE producto_id = $1) AS multimedia,
       (SELECT count(*) FROM eco_productos_pautas WHERE producto_id = $1) AS productos_pautas,
       (SELECT count(*) FROM eco_multimedia_pautas mp
          JOIN eco_multimedia m ON m.id = mp.multimedia_id
        WHERE m.producto_id = $1) AS multimedia_pautas`,
    [id],
  );
  return {
    multimedia: aNumero(rows[0].multimedia),
    productosPautas: aNumero(rows[0].productos_pautas),
    multimediaPautas: aNumero(rows[0].multimedia_pautas),
  };
}

// Textos donde el código aparece escrito. strpos es un filtro grueso (subcadena, sin mayúsculas);
// el service decide si es una mención real (palabra completa).
export async function buscarTextosConCodigo(db, codigo) {
  const { rows } = await db.query(
    `SELECT 'eco_reglas_bot' AS tabla, id, codigo || ' · ' || titulo AS etiqueta, activo, regla AS texto
       FROM eco_reglas_bot WHERE strpos(upper(regla), upper($1)) > 0
     UNION ALL
     SELECT 'eco_preguntas_frecuentes', id, '#' || numero || ' · ' || pregunta, activo, respuesta
       FROM eco_preguntas_frecuentes WHERE strpos(upper(respuesta), upper($1)) > 0
     UNION ALL
     SELECT 'eco_mensajes', id, clave, activo, texto
       FROM eco_mensajes WHERE strpos(upper(texto), upper($1)) > 0
     UNION ALL
     SELECT 'eco_productos', id, nombre || ' (' || codigo || ')', activo, compatible_con
       FROM eco_productos WHERE strpos(upper(compatible_con), upper($1)) > 0
     ORDER BY 1, 2`,
    [codigo],
  );
  return rows;
}
