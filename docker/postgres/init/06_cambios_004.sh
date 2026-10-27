#!/bin/sh
# Aplica a la réplica de desarrollo los mismos cambios que tiene producción (docs/sql, montado en /sql).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /sql/004_destinos_reglas.sql
