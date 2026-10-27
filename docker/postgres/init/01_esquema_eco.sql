-- Réplica del esquema eco_* de producción (ecofiltro_bot, PostgreSQL 18.6) para desarrollo y pruebas.
-- Reconstruida desde pg_catalog el 2026-10-26 (ver docs/base-de-datos.md). SIN datos de producción.
-- Si producción cambia, regenerar con docs/sql/inspeccionar_catalogo.sql y actualizar este archivo.

-- Roles que existen en producción y que aparecen en dueños y permisos.
CREATE ROLE eco_admin NOLOGIN;
CREATE ROLE eco_n8n NOLOGIN;

-- En producción eco_admin es dueño de la base (y por eso puede crear en public).
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I OWNER TO eco_admin', current_database()); END $$;

SET ROLE eco_admin;

-- ---------------------------------------------------------------- Funciones de trigger

CREATE FUNCTION eco_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END $function$;

CREATE FUNCTION eco_auditar() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  v_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := to_jsonb(OLD) ->> TG_ARGV[0];
    INSERT INTO eco_auditoria(tabla, operacion, registro_id, antes) VALUES (TG_TABLE_NAME, TG_OP, v_id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := to_jsonb(NEW) ->> TG_ARGV[0];
    INSERT INTO eco_auditoria(tabla, operacion, registro_id, antes, despues) VALUES (TG_TABLE_NAME, TG_OP, v_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    v_id := to_jsonb(NEW) ->> TG_ARGV[0];
    INSERT INTO eco_auditoria(tabla, operacion, registro_id, despues) VALUES (TG_TABLE_NAME, TG_OP, v_id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END $function$;

-- ---------------------------------------------------------------- Tablas

CREATE TABLE eco_auditoria (
  id          bigserial PRIMARY KEY,
  tabla       text NOT NULL,
  operacion   text NOT NULL,
  registro_id text,
  antes       jsonb,
  despues     jsonb,
  usuario_db  text NOT NULL DEFAULT CURRENT_USER,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE eco_configuracion (
  clave           text PRIMARY KEY,
  valor           text,
  tipo            text NOT NULL DEFAULT 'texto'
                  CHECK (tipo = ANY (ARRAY['booleano', 'entero', 'decimal', 'texto', 'json'])),
  descripcion     text,
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por text
);

CREATE TABLE eco_pautas (
  id              serial PRIMARY KEY,
  codigo          text NOT NULL UNIQUE,
  nombre          text NOT NULL,
  mensaje_cliente text,
  descuento_pct   numeric(5,2)
                  CHECK (descuento_pct IS NULL OR (descuento_pct >= 0 AND descuento_pct <= 100)),
  palabras_clave  text[] NOT NULL DEFAULT '{}',
  vigente_desde   timestamptz,
  vigente_hasta   timestamptz,
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  CONSTRAINT eco_pautas_check
    CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta > vigente_desde)
);

CREATE TABLE eco_productos (
  id               serial PRIMARY KEY,
  codigo           text NOT NULL UNIQUE,
  nombre           text NOT NULL,
  tipo             text NOT NULL CHECK (tipo = ANY (ARRAY['equipo', 'accesorio', 'repuesto'])),
  familia          text NOT NULL,
  capacidad_litros numeric(6,2),
  colores          text[] NOT NULL DEFAULT '{}',
  estado           text NOT NULL DEFAULT 'disponible'
                   CHECK (estado = ANY (ARRAY['disponible', 'agotado', 'descontinuado'])),
  precio_base      numeric(10,2) CHECK (precio_base IS NULL OR precio_base >= 0),
  descuento_pct    numeric(5,2) NOT NULL DEFAULT 0 CHECK (descuento_pct >= 0 AND descuento_pct <= 100),
  pauta_id         integer REFERENCES eco_pautas(id) ON DELETE SET NULL,
  woo_id           integer UNIQUE,
  palabras_clave   text[] NOT NULL DEFAULT '{}',
  orden            integer NOT NULL DEFAULT 100,
  activo           boolean NOT NULL DEFAULT true,
  notas_internas   text,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  actualizado_por  text
);
CREATE INDEX eco_productos_familia_idx ON eco_productos (familia);

CREATE TABLE eco_multimedia (
  id              serial PRIMARY KEY,
  tipo            text NOT NULL CHECK (tipo = ANY (ARRAY['imagen', 'video', 'promocion'])),
  hubspot_file_id text NOT NULL,
  descripcion     text NOT NULL,
  producto_id     integer REFERENCES eco_productos(id) ON DELETE SET NULL,
  color           text,
  tema            text,
  pauta_id        integer REFERENCES eco_pautas(id) ON DELETE SET NULL,
  orden           integer NOT NULL DEFAULT 100,
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  UNIQUE (tipo, hubspot_file_id)
);
CREATE INDEX eco_multimedia_producto_idx ON eco_multimedia (producto_id);

CREATE TABLE eco_reglas_bot (
  id              serial PRIMARY KEY,
  codigo          text NOT NULL UNIQUE,
  modulo          text NOT NULL DEFAULT 'GLOBAL'
                  CHECK (modulo = ANY (ARRAY['GLOBAL', 'SAC', 'COMPRA', 'DISTRIBUIDOR', 'PAUTAS'])),
  destino         text NOT NULL DEFAULT 'TODOS'
                  CHECK (destino = ANY (ARRAY['TODOS', 'ENRUTADOR', 'REDACTOR'])),
  categoria       text NOT NULL,
  titulo          text NOT NULL,
  regla           text NOT NULL,
  prioridad       integer NOT NULL DEFAULT 50,
  activo          boolean NOT NULL DEFAULT true,
  vigente_desde   timestamptz,
  vigente_hasta   timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por text
);

CREATE TABLE eco_preguntas_frecuentes (
  id              serial PRIMARY KEY,
  numero          integer NOT NULL UNIQUE,
  pregunta        text NOT NULL,
  tema            text,
  palabras_clave  text[] NOT NULL DEFAULT '{}',
  respuesta       text NOT NULL,
  modulos         text[] NOT NULL DEFAULT ARRAY['GLOBAL'],
  orden           integer NOT NULL DEFAULT 100,
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por text
);

-- ---------------------------------------------------------------- Triggers

CREATE TRIGGER eco_configuracion_aud AFTER INSERT OR DELETE OR UPDATE ON eco_configuracion
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('clave');
CREATE TRIGGER eco_configuracion_upd BEFORE UPDATE ON eco_configuracion
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();
CREATE TRIGGER eco_pautas_aud AFTER INSERT OR DELETE OR UPDATE ON eco_pautas
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('id');
CREATE TRIGGER eco_pautas_upd BEFORE UPDATE ON eco_pautas
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();
CREATE TRIGGER eco_productos_aud AFTER INSERT OR DELETE OR UPDATE ON eco_productos
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('id');
CREATE TRIGGER eco_productos_upd BEFORE UPDATE ON eco_productos
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();
CREATE TRIGGER eco_multimedia_aud AFTER INSERT OR DELETE OR UPDATE ON eco_multimedia
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('id');
CREATE TRIGGER eco_multimedia_upd BEFORE UPDATE ON eco_multimedia
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();
CREATE TRIGGER eco_reglas_bot_aud AFTER INSERT OR DELETE OR UPDATE ON eco_reglas_bot
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('id');
CREATE TRIGGER eco_reglas_bot_upd BEFORE UPDATE ON eco_reglas_bot
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();
CREATE TRIGGER eco_preguntas_frecuentes_aud AFTER INSERT OR DELETE OR UPDATE ON eco_preguntas_frecuentes
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('numero');
CREATE TRIGGER eco_preguntas_frecuentes_upd BEFORE UPDATE ON eco_preguntas_frecuentes
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();

-- ---------------------------------------------------------------- Vistas

CREATE VIEW eco_v_catalogo AS
SELECT p.id, p.codigo, p.nombre, p.tipo, p.familia, p.capacidad_litros, p.colores, p.estado, p.precio_base,
  CASE
    WHEN p.pauta_id IS NULL THEN p.descuento_pct
    WHEN pa.activo AND (pa.vigente_desde IS NULL OR pa.vigente_desde <= now())
                   AND (pa.vigente_hasta IS NULL OR pa.vigente_hasta > now())
      THEN GREATEST(p.descuento_pct, COALESCE(pa.descuento_pct, 0::numeric))
    ELSE 0::numeric
  END AS descuento_vigente_pct,
  pa.codigo AS pauta_codigo, pa.nombre AS pauta_nombre, p.woo_id, p.palabras_clave, p.orden
FROM eco_productos p
LEFT JOIN eco_pautas pa ON pa.id = p.pauta_id
WHERE p.activo;

CREATE VIEW eco_v_reglas_activas AS
SELECT id, codigo, modulo, destino, categoria, titulo, regla, prioridad
FROM eco_reglas_bot
WHERE activo AND (vigente_desde IS NULL OR vigente_desde <= now())
             AND (vigente_hasta IS NULL OR vigente_hasta > now())
ORDER BY prioridad, id;

CREATE VIEW eco_v_preguntas_frecuentes AS
SELECT numero, pregunta, tema, palabras_clave, respuesta, modulos
FROM eco_preguntas_frecuentes
WHERE activo
ORDER BY orden, numero;

-- ---------------------------------------------------------------- Contexto del bot

CREATE FUNCTION eco_contexto(p_modulo text DEFAULT 'GLOBAL') RETURNS jsonb LANGUAGE sql STABLE AS $function$
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
        'imagenes', (SELECT jsonb_agg(m.hubspot_file_id ORDER BY m.orden) FROM eco_multimedia m WHERE m.pauta_id = pa.id AND m.activo)
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

-- ---------------------------------------------------------------- Permisos existentes en producción

GRANT SELECT ON eco_configuracion, eco_productos, eco_pautas, eco_multimedia, eco_reglas_bot,
  eco_preguntas_frecuentes, eco_v_catalogo, eco_v_reglas_activas, eco_v_preguntas_frecuentes TO eco_n8n;
GRANT EXECUTE ON FUNCTION eco_contexto(text) TO eco_n8n;

RESET ROLE;
