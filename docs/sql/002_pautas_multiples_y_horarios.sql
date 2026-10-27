-- 002 · Varias pautas por producto + horarios de agentes por día.
--
-- Ejecutar UNA vez como eco_admin o superusuario (es idempotente: repetirlo no cambia nada):
--   set -a; . ./.env.admin; set +a; psql -X -f docs/sql/002_pautas_multiples_y_horarios.sql
--
-- Qué hace:
--   1. Crea eco_productos_pautas (relación producto ↔ pauta) y migra las asociaciones de eco_productos.pauta_id.
--   2. Reemplaza la vista eco_v_catalogo: descuento = el mayor entre el propio y el de sus pautas VIGENTES;
--      si ninguna está vigente, el producto conserva su descuento propio (antes una pauta vencida lo anulaba).
--      Mismas columnas que antes: eco_contexto() y el bot no cambian.
--   3. Crea eco_agentes_horario (rangos por día de la semana) y eco_agentes_descanso (fechas libres),
--      la función eco_agente_en_horario() y la vista eco_v_agentes_en_horario. Copia los horarios actuales
--      (hubspot_agentes.hora_inicio/hora_fin) de lunes a viernes como punto de partida.
--   4. Permisos: eco_app administra lo nuevo; eco_n8n (el bot) solo lee.
--
-- No borra ni modifica columnas existentes. eco_productos.pauta_id y hubspot_agentes.hora_inicio/hora_fin
-- se conservan para no romper nada que los lea; la app deja de usarlos.

\set ON_ERROR_STOP on
BEGIN;

-- Los objetos nuevos quedan con el mismo dueño que el resto de eco_*.
SET LOCAL ROLE eco_admin;

-- ============================================================================================
-- 1. Varias pautas por producto
-- ============================================================================================

CREATE TABLE IF NOT EXISTS eco_productos_pautas (
  producto_id     integer NOT NULL REFERENCES eco_productos (id) ON DELETE CASCADE,
  pauta_id        integer NOT NULL REFERENCES eco_pautas (id) ON DELETE CASCADE,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  PRIMARY KEY (producto_id, pauta_id)
);
CREATE INDEX IF NOT EXISTS eco_productos_pautas_pauta_idx ON eco_productos_pautas (pauta_id);

-- Auditoría: registro_id = producto, así el historial del producto muestra qué pautas se agregaron o quitaron.
CREATE OR REPLACE TRIGGER eco_productos_pautas_aud
  AFTER INSERT OR DELETE OR UPDATE ON eco_productos_pautas
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('producto_id');

INSERT INTO eco_productos_pautas (producto_id, pauta_id, actualizado_por)
SELECT id, pauta_id, 'migracion-002'
FROM eco_productos
WHERE pauta_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Misma forma que la vista anterior (mismas columnas, mismo orden): eco_contexto() la usa tal cual.
-- pauta_codigo / pauta_nombre = la pauta vigente con mayor descuento (la que el bot menciona).
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
       pv.codigo AS pauta_codigo, pv.nombre AS pauta_nombre, p.woo_id, p.palabras_clave, p.orden
FROM eco_productos p
LEFT JOIN pautas_vigentes pv ON pv.producto_id = p.id AND pv.posicion = 1
WHERE p.activo;

-- ============================================================================================
-- 2. Horarios de agentes
-- ============================================================================================
-- agente_id = hubspot_agentes.id, SIN llave foránea a propósito: n8n sincroniza esa tabla y puede borrar y
-- volver a crear agentes; una llave foránea borraría los horarios o haría fallar la sincronización.

CREATE TABLE IF NOT EXISTS eco_agentes_horario (
  id              serial PRIMARY KEY,
  agente_id       bigint NOT NULL,
  dia_semana      smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- ISO: 1 = lunes … 7 = domingo
  hora_inicio     time NOT NULL,
  hora_fin        time NOT NULL,                                        -- exclusiva; '24:00' = fin del día
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  CONSTRAINT eco_agentes_horario_rango CHECK (hora_fin > hora_inicio)
);
CREATE INDEX IF NOT EXISTS eco_agentes_horario_agente_idx ON eco_agentes_horario (agente_id, dia_semana);

-- Fechas en que el agente no atiende (día libre, vacaciones…), aunque su horario semanal diga lo contrario.
CREATE TABLE IF NOT EXISTS eco_agentes_descanso (
  id              serial PRIMARY KEY,
  agente_id       bigint NOT NULL,
  desde           date NOT NULL,
  hasta           date NOT NULL,
  motivo          text,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  CONSTRAINT eco_agentes_descanso_rango CHECK (hasta >= desde)
);
CREATE INDEX IF NOT EXISTS eco_agentes_descanso_agente_idx ON eco_agentes_descanso (agente_id, desde);

CREATE OR REPLACE TRIGGER eco_agentes_horario_aud
  AFTER INSERT OR DELETE OR UPDATE ON eco_agentes_horario
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('agente_id');
CREATE OR REPLACE TRIGGER eco_agentes_descanso_aud
  AFTER INSERT OR DELETE OR UPDATE ON eco_agentes_descanso
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('agente_id');

-- ¿El agente está en horario en este momento? Hora de Guatemala (UTC-6, sin horario de verano).
-- Sin rangos ese día = descansa. Una fecha en eco_agentes_descanso gana sobre el horario semanal.
CREATE OR REPLACE FUNCTION eco_agente_en_horario(p_agente_id bigint, p_momento timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql STABLE AS $function$
  WITH ahora AS (SELECT (p_momento AT TIME ZONE 'America/Guatemala') AS t)
  SELECT NOT EXISTS (
           SELECT 1 FROM eco_agentes_descanso d, ahora
           WHERE d.agente_id = p_agente_id AND ahora.t::date BETWEEN d.desde AND d.hasta)
     AND EXISTS (
           SELECT 1 FROM eco_agentes_horario h, ahora
           WHERE h.agente_id = p_agente_id
             AND h.dia_semana = extract(isodow FROM ahora.t)
             AND ahora.t::time >= h.hora_inicio
             AND ahora.t::time < h.hora_fin)
  FROM ahora;
$function$;

-- Lo que n8n consulta para repartir conversaciones: agentes no archivados que están en horario ahora.
CREATE OR REPLACE VIEW eco_v_agentes_en_horario AS
SELECT a.id, a.actor_id, a.nombre, a.apellido, a.email, a.bandeja, a.canal, a.estado_agente, a.limite_chats
FROM hubspot_agentes a
WHERE NOT a.archived AND eco_agente_en_horario(a.id);

-- Punto de partida: el horario actual de cada agente, de lunes a viernes. Sábado y domingo quedan como descanso
-- (ajustar en la app). Solo para agentes que todavía no tienen horario cargado.
INSERT INTO eco_agentes_horario (agente_id, dia_semana, hora_inicio, hora_fin, actualizado_por)
SELECT a.id, dia, a.hora_inicio,
       CASE WHEN a.hora_fin >= '23:59:00' THEN '24:00'::time ELSE a.hora_fin END,
       'migracion-002'
FROM hubspot_agentes a
CROSS JOIN generate_series(1, 5) AS dia
WHERE a.hora_inicio IS NOT NULL
  AND a.hora_fin IS NOT NULL
  AND a.hora_fin > a.hora_inicio
  AND NOT EXISTS (SELECT 1 FROM eco_agentes_horario h WHERE h.agente_id = a.id);

-- ============================================================================================
-- 3. Permisos
-- ============================================================================================

-- La app: administra las asociaciones y los horarios (aquí sí borra: quitar una pauta o un rango es borrar la fila).
GRANT SELECT, INSERT, DELETE ON eco_productos_pautas TO eco_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON eco_agentes_horario, eco_agentes_descanso TO eco_app;
GRANT USAGE ON SEQUENCE eco_agentes_horario_id_seq, eco_agentes_descanso_id_seq TO eco_app;
GRANT EXECUTE ON FUNCTION eco_agente_en_horario(bigint, timestamptz) TO eco_app;
GRANT SELECT ON eco_v_agentes_en_horario TO eco_app;
-- De hubspot_agentes solo lo necesario para listar agentes (sin teléfono ni IDs internos de HubSpot).
GRANT SELECT (id, nombre, apellido, email, bandeja, canal, estado_agente, archived, tipo) ON hubspot_agentes TO eco_app;

-- El bot: solo lectura. Se revoca explícitamente porque los privilegios por defecto de eco_admin le darían escritura.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON eco_productos_pautas, eco_agentes_horario, eco_agentes_descanso FROM eco_n8n;
GRANT SELECT ON eco_productos_pautas, eco_agentes_horario, eco_agentes_descanso, eco_v_agentes_en_horario TO eco_n8n;
GRANT EXECUTE ON FUNCTION eco_agente_en_horario(bigint, timestamptz) TO eco_n8n;

COMMIT;
