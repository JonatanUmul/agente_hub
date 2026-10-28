-- Ficha completa de productos en la RÉPLICA DE DESARROLLO (el bot ya no consulta la tienda web).
--
-- ⚠ Solo para docker/postgres. En producción estos cambios YA ESTÁN APLICADOS por el administrador:
--   no correr este archivo allí (reemplazaría la vista y la función de producción por esta copia).
--   Las columnas siguen la lista entregada con el cambio; la vista y la función de esta réplica se escribieron
--   a partir de la versión anterior (docs/sql/002 y 003) y deben compararse con producción usando
--   docs/sql/inspeccionar_esquema.sql. Si difieren, manda producción: actualizar este archivo.
--
-- Idempotente: se puede volver a correr sobre un volumen existente.
--   docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/08_ficha_productos.sql'

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

ALTER TABLE eco_productos
  ADD COLUMN IF NOT EXISTS descripcion_corta            text,
  ADD COLUMN IF NOT EXISTS descripcion                  text,
  ADD COLUMN IF NOT EXISTS caracteristicas              text[],
  ADD COLUMN IF NOT EXISTS material                     text,
  ADD COLUMN IF NOT EXISTS capacidad_texto              text,
  ADD COLUMN IF NOT EXISTS capacidad_purificador_litros numeric(6,2),
  ADD COLUMN IF NOT EXISTS tasa_filtrado                text,
  ADD COLUMN IF NOT EXISTS ancho_cm                     numeric(6,1),
  ADD COLUMN IF NOT EXISTS alto_cm                      numeric(6,1),
  ADD COLUMN IF NOT EXISTS largo_cm                     numeric(6,1),
  ADD COLUMN IF NOT EXISTS peso_lb                      numeric(6,2),
  ADD COLUMN IF NOT EXISTS compatible_con               text,
  ADD COLUMN IF NOT EXISTS url_web                      text;

-- Igual a docs/sql/002 con las columnas de la ficha al final (CREATE OR REPLACE solo permite agregar al final).
CREATE OR REPLACE VIEW eco_v_catalogo AS
WITH pautas_vigentes AS (
  SELECT pp.producto_id, pa.codigo, pa.nombre, COALESCE(pa.descuento_pct, 0) AS descuento_pct,
         row_number() OVER (PARTITION BY pp.producto_id
                            ORDER BY COALESCE(pa.descuento_pct, 0) DESC, pa.id) AS posicion
  FROM eco_productos_pautas pp
  JOIN eco_pautas pa ON pa.id = pp.pauta_id
  WHERE pa.activo
    AND (pa.vigente_desde IS NULL OR pa.vigente_desde <= now())
    AND (pa.vigente_hasta IS NULL OR pa.vigente_hasta > now())
)
SELECT p.id, p.codigo, p.nombre, p.tipo, p.familia, p.capacidad_litros, p.colores, p.estado, p.precio_base,
       GREATEST(p.descuento_pct, COALESCE(pv.descuento_pct, 0))::numeric AS descuento_vigente_pct,
       pv.codigo AS pauta_codigo, pv.nombre AS pauta_nombre, p.woo_id, p.palabras_clave, p.orden,
       p.descripcion_corta, p.descripcion, p.caracteristicas, p.material, p.capacidad_texto,
       p.capacidad_purificador_litros, p.tasa_filtrado, p.ancho_cm, p.alto_cm, p.largo_cm, p.peso_lb,
       p.compatible_con, p.url_web
FROM eco_productos p
LEFT JOIN pautas_vigentes pv ON pv.producto_id = p.id AND pv.posicion = 1
WHERE p.activo;

-- Igual a docs/sql/003 con la ficha en cada producto del catálogo. Los vacíos ('' o '{}') se vuelven
-- NULL y jsonb_strip_nulls los quita: no llegan al bot.
CREATE OR REPLACE FUNCTION eco_contexto(p_modulo text DEFAULT 'GLOBAL') RETURNS jsonb LANGUAGE sql STABLE AS $function$
  WITH cfg AS (
    SELECT
      COALESCE((SELECT lower(valor) = 'true' FROM eco_configuracion WHERE clave = 'precios_habilitados'), false)     AS precios,
      COALESCE((SELECT lower(valor) = 'true' FROM eco_configuracion WHERE clave = 'promociones_habilitadas'), false) AS promos,
      COALESCE((SELECT valor FROM eco_configuracion WHERE clave = 'moneda'), 'Q')                                     AS moneda
  )
  SELECT jsonb_build_object(
    'generado_en', now(),
    'modulo', upper(p_modulo),
    'precios_habilitados', cfg.precios,
    'promociones_habilitadas', cfg.promos,
    'configuracion', (SELECT COALESCE(jsonb_object_agg(clave, valor), '{}'::jsonb) FROM eco_configuracion),
    'reglas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('codigo', codigo, 'destino', destino, 'categoria', categoria, 'regla', regla) ORDER BY prioridad, id), '[]'::jsonb)
      FROM eco_v_reglas_activas
      WHERE modulo IN ('GLOBAL', upper(p_modulo))
    ),
    'catalogo', (
      SELECT COALESCE(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'codigo', c.codigo, 'nombre', c.nombre, 'tipo', c.tipo, 'familia', c.familia,
          'capacidad_litros', c.capacidad_litros, 'colores', c.colores, 'estado', c.estado,
          'precio_base',   CASE WHEN cfg.precios AND c.precio_base IS NOT NULL THEN c.precio_base END,
          'descuento_pct', CASE WHEN cfg.precios AND cfg.promos AND c.descuento_vigente_pct > 0 THEN c.descuento_vigente_pct END,
          'precio_final',  CASE WHEN cfg.precios AND c.precio_base IS NOT NULL
                                THEN round(c.precio_base * (1 - (CASE WHEN cfg.promos THEN c.descuento_vigente_pct ELSE 0 END) / 100.0), 2) END,
          'moneda',        CASE WHEN cfg.precios AND c.precio_base IS NOT NULL THEN cfg.moneda END,
          'pauta',         CASE WHEN cfg.promos AND c.descuento_vigente_pct > 0 THEN c.pauta_nombre END,
          'palabras_clave', c.palabras_clave,
          'descripcion_corta', NULLIF(btrim(c.descripcion_corta), ''),
          'descripcion',       NULLIF(btrim(c.descripcion), ''),
          'caracteristicas',   NULLIF(c.caracteristicas, '{}'),
          'material',          NULLIF(btrim(c.material), ''),
          'capacidad_texto',   NULLIF(btrim(c.capacidad_texto), ''),
          'capacidad_purificador_litros', c.capacidad_purificador_litros,
          'tasa_filtrado',     NULLIF(btrim(c.tasa_filtrado), ''),
          'ancho_cm', c.ancho_cm, 'alto_cm', c.alto_cm, 'largo_cm', c.largo_cm, 'peso_lb', c.peso_lb,
          'compatible_con',    NULLIF(btrim(c.compatible_con), ''),
          'url_web',           NULLIF(btrim(c.url_web), '')
        )) ORDER BY c.orden, c.id), '[]'::jsonb)
      FROM eco_v_catalogo c
    ),
    'pautas', CASE WHEN cfg.promos THEN (
      SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'codigo', pa.codigo, 'nombre', pa.nombre, 'mensaje', pa.mensaje_cliente,
        'descuento_pct', pa.descuento_pct, 'vigente_hasta', pa.vigente_hasta,
        'imagenes', (SELECT jsonb_agg(m.hubspot_file_id ORDER BY m.orden)
                     FROM eco_multimedia_pautas mp JOIN eco_multimedia m ON m.id = mp.multimedia_id
                     WHERE mp.pauta_id = pa.id AND m.activo)
      )) ORDER BY pa.id), '[]'::jsonb)
      FROM eco_pautas pa
      WHERE pa.activo
        AND (pa.vigente_desde IS NULL OR pa.vigente_desde <= now())
        AND (pa.vigente_hasta IS NULL OR pa.vigente_hasta >  now())
    ) ELSE '[]'::jsonb END,
    'multimedia', (
      SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'tipo', m.tipo, 'file_id', m.hubspot_file_id, 'descripcion', m.descripcion,
        'producto', p.codigo, 'color', m.color, 'tema', m.tema
      )) ORDER BY m.tipo, m.orden, m.id), '[]'::jsonb)
      FROM eco_multimedia m
      LEFT JOIN eco_productos p ON p.id = m.producto_id
      WHERE m.activo AND m.tipo IN ('imagen','video')
    )
  )
  FROM cfg;
$function$;

-- Datos ficticios: un equipo completo, uno sin peso y con una característica que contradice su purificador,
-- y un repuesto con compatibilidad. Solo si la ficha está vacía (no pisa lo editado en desarrollo).
UPDATE eco_productos SET
  descripcion_corta = 'Equipo de prueba con ficha completa.',
  descripcion = 'Descripción comercial ficticia del equipo de prueba 1.',
  caracteristicas = ARRAY['Fácil de limpiar', 'Capacidad del purificador de agua 10 L'],
  material = 'Plástico de prueba', capacidad_texto = '20 L', capacidad_purificador_litros = 10,
  tasa_filtrado = '1-2 litros por hora', ancho_cm = 37.5, alto_cm = 59, largo_cm = 37.5, peso_lb = 12.5,
  url_web = 'https://ecofiltro.com.gt/producto/prueba-1/', actualizado_por = 'semilla-dev'
WHERE codigo = 'DEV-EQ-1' AND descripcion IS NULL;

UPDATE eco_productos SET
  descripcion = 'Equipo de prueba sin peso (como el Tonelito y el Pachón en la web).',
  caracteristicas = ARRAY['Capacidad del purificador de agua 10 L'],
  material = 'Barro de prueba', capacidad_texto = '10 L', capacidad_purificador_litros = 1.5,
  tasa_filtrado = '1 litro por hora', ancho_cm = 30, alto_cm = 45, actualizado_por = 'semilla-dev'
WHERE codigo = 'DEV-EQ-2' AND descripcion IS NULL;

UPDATE eco_productos SET
  descripcion_corta = 'Repuesto de prueba.', compatible_con = 'Equipo de prueba 1 y 2',
  capacidad_purificador_litros = 10, actualizado_por = 'semilla-dev'
WHERE codigo = 'DEV-RE-1' AND compatible_con IS NULL;

COMMIT;
