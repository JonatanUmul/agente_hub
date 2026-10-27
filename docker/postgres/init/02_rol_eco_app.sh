#!/bin/sh
# Desarrollo: crea eco_app con la contraseña de .env (DB_PASSWORD) y le aplica los MISMOS permisos
# que en producción, desde docs/sql/crear_rol_eco_app.sql (montado en /sql).
set -eu
psql -v ON_ERROR_STOP=1 -v pass="$ECO_APP_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE eco_app LOGIN NOINHERIT PASSWORD :'pass';
GRANT CONNECT ON DATABASE :"DBNAME" TO eco_app;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /sql/crear_rol_eco_app.sql
