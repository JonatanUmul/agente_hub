-- 003 · Varias pautas por archivo de multimedia.
--
-- Ejecutar UNA vez como eco_admin o superusuario, DESPUÉS de 002 (es idempotente):
--   psql -X -f docs/sql/003_multimedia_varias_pautas.sql
--
-- Qué hace:
--   1. Crea eco_multimedia_pautas (relación archivo ↔ pauta) y migra las asociaciones de eco_multimedia.pauta_id.
--   2. Reemplaza eco_contexto(): las "imagenes" de cada pauta salen de la tabla nueva. Es la ÚNICA línea que cambia;
--      el resto de la función y la forma del JSON que recibe el bot quedan idénticos.
--   3. Permisos: eco_app administra las asociaciones; eco_n8n (el bot) solo lee.
--
-- No borra ni modifica columnas: eco_multimedia.pauta_id se conserva (la app guarda ahí la primera pauta).

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

CREATE TABLE IF NOT EXISTS eco_multimedia_pautas (
  multimedia_id   integer NOT NULL REFERENCES eco_multimedia (id) ON DELETE CASCADE,
  pauta_id        integer NOT NULL REFERENCES eco_pautas (id) ON DELETE CASCADE,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  PRIMARY KEY (multimedia_id, pauta_id)
);
CREATE INDEX IF NOT EXISTS eco_multimedia_pautas_pauta_idx ON eco_multimedia_pautas (pauta_id);

-- Auditoría: registro_id = archivo, así el historial del archivo muestra qué pautas se agregaron o quitaron.
CREATE OR REPLACE TRIGGER eco_multimedia_pautas_aud
  AFTER INSERT OR DELETE OR UPDATE ON eco_multimedia_pautas
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('multimedia_id');

INSERT INTO eco_multimedia_pautas (multimedia_id, pauta_id, actualizado_por)
SELECT id, pauta_id, 'migracion-003'
FROM eco_multimedia
WHERE pauta_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Igual a la versión anterior salvo 'imagenes' (ahora desde eco_multimedia_pautas).
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
          'palabras_clave', c.palabras_clave
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

-- Permisos (CREATE OR REPLACE FUNCTION conserva los EXECUTE ya otorgados).
GRANT SELECT, INSERT, DELETE ON eco_multimedia_pautas TO eco_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON eco_multimedia_pautas FROM eco_n8n;
GRANT SELECT ON eco_multimedia_pautas TO eco_n8n;

COMMIT;
