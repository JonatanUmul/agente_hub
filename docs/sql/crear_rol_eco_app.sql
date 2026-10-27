-- Permisos del rol eco_app (usuario de la API de Ecofiltro Gestión) en ecofiltro_bot.
--
-- El rol YA EXISTE en producción (LOGIN, sin superusuario, solo CONNECT). Si hubiera que crearlo:
--   CREATE ROLE eco_app LOGIN PASSWORD '<contraseña generada>';   -- nunca guardar la contraseña aquí
--
-- Ejecutar como superusuario (ecofiltro / ecofiltro_admin): CREATE SCHEMA ... AUTHORIZATION eco_app
-- exige poder actuar como eco_app, y eco_admin no puede.
--   psql -X -d ecofiltro_bot -f docs/sql/crear_rol_eco_app.sql
-- Es idempotente: se puede volver a correr sin efectos secundarios.

\set ON_ERROR_STOP on
BEGIN;

-- Lectura y escritura del contenido que administra la app. Sin DELETE: la app desactiva, no borra.
GRANT SELECT, INSERT, UPDATE ON
  eco_configuracion, eco_productos, eco_pautas, eco_multimedia, eco_reglas_bot, eco_preguntas_frecuentes
TO eco_app;
REVOKE DELETE, TRUNCATE ON
  eco_configuracion, eco_productos, eco_pautas, eco_multimedia, eco_reglas_bot, eco_preguntas_frecuentes
FROM eco_app;

-- Los id son serial: insertar necesita USAGE sobre su secuencia (eco_configuracion usa clave, no tiene).
GRANT USAGE ON SEQUENCE
  eco_productos_id_seq, eco_pautas_id_seq, eco_multimedia_id_seq, eco_reglas_bot_id_seq,
  eco_preguntas_frecuentes_id_seq
TO eco_app;

-- Vistas que lee el bot (para vista previa y precio vigente).
GRANT SELECT ON eco_v_catalogo, eco_v_reglas_activas, eco_v_preguntas_frecuentes TO eco_app;

-- Auditoría. La app solo la consulta, PERO el trigger eco_auditar() no es SECURITY DEFINER:
-- inserta en eco_auditoria con los permisos de quien modifica. Sin INSERT + USAGE de la secuencia,
-- cualquier guardado de la app fallaría. (Hacerlo SECURITY DEFINER cambiaría usuario_db, que usa
-- CURRENT_USER, a 'eco_admin' para todos, y además modifica una estructura existente.)
GRANT SELECT, INSERT ON eco_auditoria TO eco_app;
GRANT USAGE ON SEQUENCE eco_auditoria_id_seq TO eco_app;
REVOKE UPDATE, DELETE, TRUNCATE ON eco_auditoria FROM eco_app;

-- Vista previa "¿Qué ve el bot ahora?".
GRANT EXECUTE ON FUNCTION eco_contexto(text) TO eco_app;

-- Esquema propio de la app (usuarios, sesiones, migraciones).
CREATE SCHEMA IF NOT EXISTS gestion AUTHORIZATION eco_app;

COMMIT;

-- OPCIONAL (decisión del administrador): en producción existe este privilegio por defecto,
-- que daría a eco_app INSERT/SELECT/UPDATE/DELETE sobre cualquier tabla nueva que ecofiltro_admin
-- cree en public (incluidas futuras tablas operativas del bot). Recomendado revocarlo:
--   ALTER DEFAULT PRIVILEGES FOR ROLE ecofiltro_admin IN SCHEMA public REVOKE ALL ON TABLES FROM eco_app;
