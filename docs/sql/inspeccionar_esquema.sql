-- Inspección de SOLO LECTURA del esquema real (catálogos del sistema, sin leer datos de negocio).
-- Uso: psql -X -f docs/sql/inspeccionar_esquema.sql   (con PGOPTIONS='-c default_transaction_read_only=on')
\pset pager off
\echo '== Versión'
SELECT version();

\echo '== Columnas de tablas y vistas eco_*'
SELECT c.table_name, c.ordinal_position AS pos, c.column_name, c.data_type, c.udt_name,
       c.is_nullable, c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name LIKE 'eco\_%'
ORDER BY c.table_name, c.ordinal_position;

\echo '== Restricciones (PK, UNIQUE, CHECK, FK)'
SELECT conrelid::regclass AS tabla, conname, contype, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text LIKE 'eco\_%'
ORDER BY 1, 3, 2;

\echo '== Índices'
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename LIKE 'eco\_%' ORDER BY 1, 2;

\echo '== Triggers'
SELECT event_object_table AS tabla, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table LIKE 'eco\_%' ORDER BY 1, 2, 4;

\echo '== Vistas'
SELECT viewname, definition FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'eco\_%';

\echo '== Funciones eco_* / de triggers'
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS argumentos,
       pg_get_function_result(p.oid) AS retorno, pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'eco\_%';

\echo '== Claves de eco_configuracion (solo clave y tipo, sin valores)'
SELECT clave, tipo, descripcion FROM eco_configuracion ORDER BY clave;

\echo '== Esquemas y roles existentes relevantes'
SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\_%' AND nspname <> 'information_schema';
SELECT rolname FROM pg_roles WHERE rolname IN ('eco_app') OR rolname LIKE 'eco%';
