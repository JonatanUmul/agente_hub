-- Complemento de solo lectura: lee pg_catalog directamente porque information_schema
-- oculta los objetos sobre los que el usuario conectado no tiene privilegios.
\pset pager off
\echo '== Usuario conectado'
SELECT current_user, session_user;

\echo '== Columnas (pg_attribute)'
SELECT c.relname AS tabla, c.relkind, a.attnum AS pos, a.attname AS columna,
       format_type(a.atttypid, a.atttypmod) AS tipo, a.attnotnull AS not_null,
       pg_get_expr(d.adbin, d.adrelid) AS por_defecto,
       a.attidentity AS identidad
FROM pg_class c
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE c.relnamespace = 'public'::regnamespace AND c.relname LIKE 'eco\_%' AND c.relkind IN ('r','v')
ORDER BY c.relkind, c.relname, a.attnum;

\echo '== Triggers (pg_trigger)'
SELECT tgrelid::regclass AS tabla, tgname, pg_get_triggerdef(oid) AS definicion
FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text LIKE 'eco\_%' ORDER BY 1, 2;

\echo '== Dueños y privilegios de objetos eco_*'
SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS dueno, c.relacl
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relname LIKE 'eco\_%' AND c.relkind IN ('r','v','S')
ORDER BY c.relkind, c.relname;

\echo '== Privilegios de funciones eco_*'
SELECT p.proname, pg_get_userbyid(p.proowner) AS dueno, p.proacl, p.prosecdef AS security_definer
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'eco\_%';

\echo '== Atributos y membresías de roles eco*'
SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolinherit,
       ARRAY(SELECT b.rolname FROM pg_auth_members m JOIN pg_roles b ON b.oid = m.roleid WHERE m.member = r.oid) AS miembro_de
FROM pg_roles r WHERE r.rolname LIKE 'eco%' ORDER BY 1;

\echo '== Privilegios sobre la base y el esquema public'
SELECT datname, pg_get_userbyid(datdba) AS dueno, datacl FROM pg_database WHERE datname = current_database();
SELECT nspname, pg_get_userbyid(nspowner) AS dueno, nspacl FROM pg_namespace WHERE nspname = 'public';

\echo '== Privilegios por defecto'
SELECT pg_get_userbyid(defaclrole) AS rol, defaclnamespace::regnamespace AS esquema, defaclobjtype, defaclacl FROM pg_default_acl;

\echo '== Extensiones'
SELECT extname, extversion FROM pg_extension ORDER BY 1;
