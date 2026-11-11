-- 005 · Variante y nombre corto de los productos, e ItemCode único sin importar mayúsculas.
--
-- Ejecutar UNA vez como eco_admin o superusuario (es idempotente: correrlo de nuevo no cambia nada):
--   set -a; . ./.env.admin; set +a; psql -X -f docs/sql/005_productos_variantes.sql
--
-- Qué hace:
--   1. eco_productos.variante: estilo dentro de la familia («Flor Azul», «Cola de Ratón»). NULL sin variantes.
--   2. eco_productos.nombre_corto: cómo lo nombra el bot en una lista («Cerámica Flor Azul»). NULL = usa nombre.
--   3. Índice único sobre upper(codigo): «llave» y «LLAVE» no pueden convivir. Si ya hay códigos que solo
--      difieren en mayúsculas, el script se detiene y los lista para corregirlos antes.
--
-- No toca eco_contexto() ni ninguna vista. Los permisos de eco_app sobre eco_productos ya cubren las columnas nuevas.
-- Debe aplicarse ANTES de desplegar la versión de la app que las usa (la app las lee al listar productos).

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

ALTER TABLE eco_productos ADD COLUMN IF NOT EXISTS variante     text;
ALTER TABLE eco_productos ADD COLUMN IF NOT EXISTS nombre_corto text;

DO $$
DECLARE
  repetidos text;
BEGIN
  SELECT string_agg(codigos, '; ') INTO repetidos
  FROM (
    SELECT string_agg(codigo || ' (id ' || id || ')', ', ' ORDER BY id) AS codigos
    FROM eco_productos
    GROUP BY upper(codigo)
    HAVING count(*) > 1
  ) r;
  IF repetidos IS NOT NULL THEN
    RAISE EXCEPTION 'ItemCode repetidos sin importar mayúsculas: %', repetidos;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS eco_productos_codigo_uniq ON eco_productos (upper(codigo));

COMMIT;
