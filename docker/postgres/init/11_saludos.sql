-- Saludos del bot por temporada en la RÉPLICA DE DESARROLLO.
--
-- Solo para docker/postgres: en producción el administrador ya creó la tabla, la función eco_saludo() y la clave
-- menu_bienvenida_texto. No correr este archivo allí.
--
-- Idempotente:
--   docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/11_saludos.sql'

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

CREATE TABLE IF NOT EXISTS eco_saludos (
  id              serial PRIMARY KEY,
  nombre          text NOT NULL,
  modulo          text NOT NULL DEFAULT 'GLOBAL'
                  CHECK (modulo = ANY (ARRAY['GLOBAL', 'MENU', 'COMPRA', 'SAC', 'DISTRIBUIDOR'])),
  saludo          text NOT NULL CHECK (char_length(saludo) BETWEEN 3 AND 300),
  fecha_inicio    date,
  fecha_fin       date,
  repetir_anual   boolean NOT NULL DEFAULT false,
  prioridad       integer NOT NULL DEFAULT 0,
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  UNIQUE (modulo, nombre),
  CHECK ((fecha_inicio IS NULL) = (fecha_fin IS NULL)),
  CHECK (fecha_inicio IS NULL OR repetir_anual OR fecha_fin >= fecha_inicio)
);

CREATE OR REPLACE TRIGGER eco_saludos_aud AFTER INSERT OR DELETE OR UPDATE ON eco_saludos
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('id');
CREATE OR REPLACE TRIGGER eco_saludos_upd BEFORE UPDATE ON eco_saludos
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();

-- Saludo de hoy (hora de Guatemala): activos de GLOBAL + el módulo y vigentes; gana la mayor prioridad, a igual
-- prioridad el del módulo; si siguen empatados, uno al azar. {momento} = Buenos días / Buenas tardes / Buenas noches.
CREATE OR REPLACE FUNCTION eco_saludo(p_modulo text) RETURNS text LANGUAGE sql VOLATILE AS $function$
  WITH hoy AS (
    SELECT t::date AS d, to_char(t, 'MM-DD') AS md, extract(hour FROM t)::int AS h
    FROM (SELECT now() AT TIME ZONE 'America/Guatemala' AS t) x
  )
  SELECT replace(s.saludo, '{momento}',
                 CASE WHEN hoy.h BETWEEN 5 AND 11 THEN 'Buenos días'
                      WHEN hoy.h BETWEEN 12 AND 18 THEN 'Buenas tardes'
                      ELSE 'Buenas noches' END)
  FROM eco_saludos s, hoy
  WHERE s.activo
    AND s.modulo IN ('GLOBAL', upper(p_modulo))
    AND (s.fecha_inicio IS NULL
         OR (NOT s.repetir_anual AND hoy.d BETWEEN s.fecha_inicio AND s.fecha_fin)
         OR (s.repetir_anual AND CASE
               WHEN to_char(s.fecha_inicio, 'MM-DD') <= to_char(s.fecha_fin, 'MM-DD')
                 THEN hoy.md BETWEEN to_char(s.fecha_inicio, 'MM-DD') AND to_char(s.fecha_fin, 'MM-DD')
               ELSE hoy.md >= to_char(s.fecha_inicio, 'MM-DD') OR hoy.md <= to_char(s.fecha_fin, 'MM-DD')
             END))
  ORDER BY s.prioridad DESC, (s.modulo = upper(p_modulo)) DESC, random()
  LIMIT 1;
$function$;

GRANT SELECT, INSERT, UPDATE, DELETE ON eco_saludos TO eco_app;
GRANT USAGE ON SEQUENCE eco_saludos_id_seq TO eco_app;
GRANT SELECT ON eco_saludos TO eco_n8n;
GRANT EXECUTE ON FUNCTION eco_saludo(text) TO eco_app, eco_n8n;

INSERT INTO eco_configuracion (clave, valor, tipo, descripcion, actualizado_por)
VALUES ('menu_bienvenida_texto', '¿En qué te puedo ayudar hoy? Elige una opción:', 'texto',
        'Texto que sigue al saludo en el menú inicial', 'semilla-dev')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO eco_saludos (nombre, modulo, saludo, fecha_inicio, fecha_fin, repetir_anual, prioridad, actualizado_por) VALUES
  ('Normal',        'GLOBAL', '¡{momento}! 😊 Soy Eco, asistente de Ecofiltro Guatemala.', NULL, NULL, false, 0, 'semilla-dev'),
  ('Navidad',       'GLOBAL', '¡Feliz Navidad! 🎄 Soy Eco, asistente de Ecofiltro Guatemala.', '2026-12-15', '2026-12-26', true, 10, 'semilla-dev'),
  ('Año Nuevo',     'GLOBAL', '¡Feliz Año Nuevo! 🎉 Soy Eco, asistente de Ecofiltro Guatemala.', '2026-12-31', '2027-01-03', true, 10, 'semilla-dev'),
  ('Independencia', 'MENU',   '¡Feliz día de la Independencia! 🇬🇹 Soy Eco, de Ecofiltro.', '2026-09-14', '2026-09-15', false, 10, 'semilla-dev')
ON CONFLICT (modulo, nombre) DO NOTHING;

COMMIT;
