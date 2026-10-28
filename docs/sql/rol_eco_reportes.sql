-- Rol de SOLO LECTURA para el módulo de reportes de Ecofiltro Gestión.
--
-- Lo ejecuta el administrador, como eco_admin o superusuario (idempotente):
--   psql -X -f docs/sql/rol_eco_reportes.sql
-- y luego le asigna contraseña (NUNCA en este archivo):
--   ALTER ROLE eco_reportes PASSWORD '<contraseña generada>';
--
-- Permisos POR COLUMNA: solo las columnas que usan las consultas de docs/reportes-indicadores.md.
-- Así, aunque la app tuviera un error, este rol no puede leer datos de clientes: de `eventos` NO tiene message,
-- respuesta_n8n, resumen_ia, name, sesionid_cliente ni createdby; de hubspot_webhook_log NO tiene payload; de
-- hubspot_agentes NO tiene teléfono ni correo. Probado: count(*) y EXISTS funcionan con permisos por columna;
-- SELECT * o leer otra columna da "permission denied".

\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eco_reportes') THEN
    CREATE ROLE eco_reportes LOGIN NOINHERIT;
  END IF;
END $$;
-- La app abre hasta 3 conexiones de reportes; 5 deja margen para una prueba manual.
ALTER ROLE eco_reportes CONNECTION LIMIT 5;

DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO eco_reportes', current_database()); END $$;
GRANT USAGE ON SCHEMA public TO eco_reportes;

-- Tablas operativas del bot (solo lo necesario).
GRANT SELECT (id, conversationsthreadid, fecha_registro, workflow, etapa_descripcion, status, bandeja,
              menu_descripcion_opcion, fileid, numero_pregunta)
  ON eventos TO eco_reportes;
GRANT SELECT (object_id, subscription_type, received_at) ON hubspot_webhook_log TO eco_reportes;
GRANT SELECT (conversationsthreadid, id_hubspot_agentes, fecha_registro) ON chat_asignados TO eco_reportes;
-- `message` es el texto que ENVÍA el bot (no el cliente): se usa para reconocer la oferta de recuperación.
GRANT SELECT (conversationsthreadid, action, sent_at, message) ON conversation_inactivity_control TO eco_reportes;
GRANT SELECT (conversationsthreadid, notified_at, motivo) ON agent_hours_notice_control TO eco_reportes;
GRANT SELECT (id, nombre, apellido, bandeja) ON hubspot_agentes TO eco_reportes;

-- Catálogos de la app para poner nombres (pauta, pregunta, archivo, producto).
GRANT SELECT (codigo, nombre) ON eco_pautas TO eco_reportes;
GRANT SELECT (numero, pregunta) ON eco_preguntas_frecuentes TO eco_reportes;
GRANT SELECT (hubspot_file_id, tipo, descripcion, producto_id) ON eco_multimedia TO eco_reportes;
GRANT SELECT (id, codigo, nombre) ON eco_productos TO eco_reportes;

COMMIT;

-- ÍNDICES SUGERIDOS (no se crean aquí; ver docs/reportes-indicadores.md). Útiles cuando las tablas crezcan:
--   CREATE INDEX CONCURRENTLY eventos_fecha_idx ON eventos (fecha_registro);
--   CREATE INDEX CONCURRENTLY hubspot_webhook_log_received_idx ON hubspot_webhook_log (received_at);
--   CREATE INDEX CONCURRENTLY chat_asignados_fecha_idx ON chat_asignados (fecha_registro);
