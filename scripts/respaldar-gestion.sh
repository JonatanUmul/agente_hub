#!/bin/sh
# Respaldo del esquema `gestion` (usuarios, sesiones y migraciones de la app).
# Las tablas eco_* son de la base del bot: se respaldan con el respaldo general de ecofiltro_bot.
#
# Uso (en el servidor, desde la carpeta de la app):   ./scripts/respaldar-gestion.sh
# Programado a diario a las 2:30:   30 2 * * * cd /ruta/app && ./scripts/respaldar-gestion.sh >> respaldos/respaldo.log 2>&1
# Restaurar:   ver docs/despliegue.md
set -eu

# Lee la configuración de .env sin mostrarla.
set -a
. ./.env
set +a

DIR="${RESPALDOS_DIR:-./respaldos}"
DIAS="${RESPALDOS_DIAS:-30}"
ARCHIVO="$DIR/gestion-$(date +%Y%m%d-%H%M%S).dump"
mkdir -p "$DIR"

# pg_dump corre en un contenedor temporal dentro de la red de la base: no hace falta instalar
# PostgreSQL en el servidor ni exponer la base. La contraseña viaja por variable, no en la línea de comandos.
docker run --rm --network "$RED_BD" -e PGPASSWORD="$DB_PASSWORD" postgres:18-alpine \
  pg_dump --host "$DB_HOST" --port "${DB_PORT:-5432}" --username "$DB_USER" --dbname "$DB_NAME" \
  --schema gestion --format custom > "$ARCHIVO"

chmod 600 "$ARCHIVO"
echo "$(date '+%F %T') respaldo creado: $ARCHIVO ($(wc -c < "$ARCHIVO") bytes)"

# Borra respaldos con más de $DIAS días.
find "$DIR" -name 'gestion-*.dump' -mtime "+$DIAS" -print -delete
