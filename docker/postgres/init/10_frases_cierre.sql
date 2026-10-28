-- Frases de cierre del bot en la RÉPLICA DE DESARROLLO.
--
-- ⚠ Solo para docker/postgres. En producción el administrador ya creó la tabla, el interruptor y el cambio de
--   eco_contexto(): no correr este archivo allí. La forma de cada frase en eco_contexto()->'frases_cierre'
--   ({modulo, situacion, frase}) es la supuesta para desarrollo; la app la muestra sin depender de ella.
--
-- Idempotente:
--   docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/10_frases_cierre.sql'

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

CREATE TABLE IF NOT EXISTS eco_frases_cierre (
  id              serial PRIMARY KEY,
  modulo          text NOT NULL DEFAULT 'GLOBAL'
                  CHECK (modulo = ANY (ARRAY['GLOBAL', 'COMPRA', 'SAC', 'DISTRIBUIDOR'])),
  situacion       text NOT NULL DEFAULT 'general'
                  CHECK (situacion = ANY (ARRAY['general', 'producto', 'problema'])),
  frase           text NOT NULL CHECK (char_length(frase) BETWEEN 3 AND 200),
  activo          boolean NOT NULL DEFAULT true,
  orden           integer NOT NULL DEFAULT 100,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  UNIQUE (modulo, situacion, frase)
);

CREATE OR REPLACE TRIGGER eco_frases_cierre_aud AFTER INSERT OR DELETE OR UPDATE ON eco_frases_cierre
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('id');
CREATE OR REPLACE TRIGGER eco_frases_cierre_upd BEFORE UPDATE ON eco_frases_cierre
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON eco_frases_cierre TO eco_app;
GRANT USAGE ON SEQUENCE eco_frases_cierre_id_seq TO eco_app;
GRANT SELECT ON eco_frases_cierre TO eco_n8n;

INSERT INTO eco_configuracion (clave, valor, tipo, descripcion, actualizado_por)
VALUES ('cierre_automatico', 'true', 'booleano',
        'Si el bot termina sus mensajes con una frase de cierre de eco_frases_cierre', 'semilla-dev')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO eco_frases_cierre (modulo, situacion, frase, orden, actualizado_por) VALUES
  ('GLOBAL', 'general',  '¿Hay algo más en lo que pueda ayudarte? 😊', 10, 'semilla-dev'),
  ('GLOBAL', 'general',  '¿Te ayudo con algo más? 💧',                 20, 'semilla-dev'),
  ('GLOBAL', 'general',  '¿Tienes alguna otra duda? 🙌',               30, 'semilla-dev'),
  ('COMPRA', 'producto', '¿Quieres que te cuente de otro modelo? ✨',   10, 'semilla-dev'),
  ('COMPRA', 'producto', '¿Te gustaría ver otro color? 💙',            20, 'semilla-dev'),
  ('SAC',    'problema', '¿Pudimos resolver tu consulta? 🛠️',          10, 'semilla-dev'),
  ('SAC',    'problema', '¿Te ayudo con algo más de tu pedido? 🙏',    20, 'semilla-dev')
ON CONFLICT (modulo, situacion, frase) DO NOTHING;

-- Igual a 08_ficha_productos.sql más 'frases_cierre': activas de GLOBAL + el módulo, por orden e id.
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
    'frases_cierre', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('modulo', f.modulo, 'situacion', f.situacion, 'frase', f.frase)
                                ORDER BY f.orden, f.id), '[]'::jsonb)
      FROM eco_frases_cierre f
      WHERE f.activo AND f.modulo IN ('GLOBAL', upper(p_modulo))
    ),
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

COMMIT;
