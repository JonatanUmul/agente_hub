#!/bin/sh
# Aplica a la réplica de desarrollo los mismos cambios que se aplican en producción (docs/sql, montado en /sql).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /sql/002_pautas_multiples_y_horarios.sql
