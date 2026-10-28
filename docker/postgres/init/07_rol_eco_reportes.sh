#!/bin/sh
# Desarrollo: crea eco_reportes con la contraseña de .env (DB_REPORTES_PASSWORD) y le aplica los MISMOS permisos
# por columna que en producción (docs/sql/rol_eco_reportes.sql, montado en /sql).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /sql/rol_eco_reportes.sql
psql -v ON_ERROR_STOP=1 -v pass="$ECO_REPORTES_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
ALTER ROLE eco_reportes PASSWORD :'pass';
SQL
