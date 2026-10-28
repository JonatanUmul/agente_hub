# Despliegue en producción

La base `ecofiltro_bot` **ya está desplegada** en el servidor. Esta guía instala solo la app y la conecta a esa base.

```
Internet ──HTTPS──► proxy del servidor ──► 127.0.0.1:8080 ─► [web: nginx] ──/api──► [api: Node] ──red Docker de la base──► PostgreSQL
```

- **web** (nginx): sirve la interfaz y reenvía `/api` a la API. Es lo único publicado, y solo en `127.0.0.1`.
- **api** (Node 22): se une a la red de Docker de la base. No publica puertos. Corre como usuario sin privilegios,
  con sistema de archivos de solo lectura.
- La app se conecta como **`eco_app`** (permisos mínimos). Las credenciales de `eco_admin` nunca van en el servidor de la app.

## Requisitos

- Docker y Docker Compose v2 en el servidor.
- Un dominio con HTTPS en el proxy del servidor (la cookie de sesión es `Secure`: sin HTTPS no se puede iniciar sesión).
- Contraseña de `eco_app` en producción.

## 1. Permisos en la base (una sola vez, como `eco_admin`)

Desde una máquina con acceso a la base (por ejemplo, la del desarrollador con el túnel SSH y `.env.admin`):

```bash
set -a; . ./.env.admin; set +a
psql -X -f docs/sql/crear_rol_eco_app.sql
```

Qué hace (detalle en el propio archivo): da a `eco_app` `SELECT/INSERT/UPDATE` sobre las tablas `eco_*` (sin `DELETE`),
`SELECT` sobre las vistas, `INSERT` en `eco_auditoria` (lo exige el trigger), `EXECUTE` sobre `eco_contexto` y crea el
esquema `gestion`. Es idempotente. **No modifica ninguna tabla, vista ni función existente.**

Verificar:

```bash
psql -X -c "SELECT has_table_privilege('eco_app', 'eco_productos', 'UPDATE'), has_table_privilege('eco_app', 'eco_productos', 'DELETE')"
#  t | f
```

### 1b. Cambios de estructura de la app (una sola vez, en orden)

```bash
psql -X -f docs/sql/002_pautas_multiples_y_horarios.sql   # varias pautas por producto + horarios de agentes
psql -X -f docs/sql/003_multimedia_varias_pautas.sql       # varias pautas por archivo de multimedia
psql -X -f docs/sql/004_destinos_reglas.sql                # destinos SELECTOR, ORQUESTADOR y VISION
psql -X -f docs/sql/rol_eco_reportes.sql                   # rol de solo lectura del dashboard de reportes
psql -X -c "ALTER ROLE eco_reportes PASSWORD '<contraseña generada>'"
```

Idempotente. Los que ya estén aplicados en producción (al 28-10-2026: 002, 003, 004 y `rol_eco_reportes`) no hace
falta repetirlos. La ficha de productos (columnas nuevas de `eco_productos`) la aplicó el administrador y no tiene
script en `docs/sql`. Después de aplicarlo, actualizar los flujos de n8n que usen horarios (ver `prompt_claude_desktop_n8n.md`).

## 2. Datos del servidor

En el servidor, identificar la red de Docker y el contenedor de PostgreSQL:

```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i postgres
docker inspect -f '{{range $red, $_ := .NetworkSettings.Networks}}{{$red}} {{end}}' <contenedor_postgres>
```

- `RED_BD` = la red que muestra el segundo comando.
- `DB_HOST` = el nombre del contenedor (o del servicio de Compose) de PostgreSQL.

## 3. Instalar la app

```bash
git clone <repositorio> /opt/ecofiltro-gestion
cd /opt/ecofiltro-gestion
git checkout ecofiltro-gestion        # o la rama/etiqueta a desplegar
cp .env.produccion.example .env
chmod 600 .env
nano .env                              # CORS_ORIGIN, RED_BD, DB_HOST, DB_PASSWORD (de eco_app),
                                       # DB_REPORTES_USER / DB_REPORTES_PASSWORD (de eco_reportes)…
```

## 4. Construir, migrar y verificar

```bash
C="docker compose -f docker-compose.prod.yml"

$C build
$C run --rm --no-deps api node scripts/migrar.js          # crea las tablas de gestion
$C run --rm --no-deps api node scripts/verificar-datos.js # solo lectura: la app puede leer y guardar los datos actuales
$C up -d
$C ps                                                     # api y web deben quedar "healthy"
curl -s http://127.0.0.1:8080/api/salud                   # {"estado":"ok","baseDatos":"ok",…}
```

## 5. Primer administrador

```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps api node scripts/crear-admin.js
```

Pide correo, nombre y contraseña (no se muestra al escribirla). Los demás usuarios se crean desde la app (Usuarios).

## 6. Proxy del servidor

Apuntar el dominio a `http://127.0.0.1:8080` (o el `WEB_PUERTO` elegido), con HTTPS, reenviando
`X-Forwarded-For` y `X-Forwarded-Proto`. Ejemplo para Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name gestion.ejemplo.com;
    # ssl_certificate … (Let's Encrypt u otro)

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

> **`TRUST_PROXY_SALTOS`** (por defecto 2 = nginx del contenedor + proxy del servidor) le dice a la API cuántos
> proxies hay delante, para tomar la IP real del cliente en el límite de intentos de login. Si el proxy del servidor
> también es un contenedor en otra red o hay otro salto (Cloudflare, balanceador), ajustarlo.

Si el proxy es un contenedor (Traefik, Nginx Proxy Manager, Caddy…), en lugar de `127.0.0.1:8080` se puede unir
`web` a la red del proxy con un `docker-compose.override.yml`.

## Actualizar

```bash
cd /opt/ecofiltro-gestion
git pull
C="docker compose -f docker-compose.prod.yml"
$C build
$C run --rm --no-deps api node scripts/migrar.js
$C up -d
```

**Volver a la versión anterior:** `git checkout <commit anterior>` y repetir `build` + `up -d`. Las migraciones son
solo del esquema `gestion`; si una versión nueva agregó alguna, revertirla antes con
`$C run --rm --no-deps api node scripts/migrar.js down`.

## Respaldos

- **Tablas `eco_*`**: son de la base del bot; quedan cubiertas por el respaldo general de `ecofiltro_bot`
  (confirmar que exista).
- **Esquema `gestion`** (usuarios y sesiones de la app): `scripts/respaldar-gestion.sh`.

```bash
./scripts/respaldar-gestion.sh                 # crea respaldos/gestion-AAAAMMDD-HHMMSS.dump (chmod 600)
crontab -e                                     # diario a las 2:30
30 2 * * * cd /opt/ecofiltro-gestion && ./scripts/respaldar-gestion.sh >> respaldos/respaldo.log 2>&1
```

Conserva `RESPALDOS_DIAS` días (30 por defecto).

**Restaurar** (reemplaza las tablas de `gestion` con las del respaldo). En producción el esquema `gestion` es de
`eco_admin`, así que `eco_app` no puede borrarlo ni recrearlo: se restauran las tablas saltando la entrada del esquema
(probado; un `pg_restore --clean` directo falla con "must be owner of schema gestion").

```bash
set -a; . ./.env; set +a
RESPALDO=respaldos/gestion-AAAAMMDD-HHMMSS.dump
docker run --rm -i --network "$RED_BD" -e PGPASSWORD="$DB_PASSWORD" -v "$PWD/$RESPALDO:/r.dump:ro" postgres:18-alpine sh -c '
  pg_restore -l /r.dump | grep -v " SCHEMA - gestion " > /tmp/lista &&
  pg_restore --host "'"$DB_HOST"'" --username eco_app --dbname ecofiltro_bot \
             --clean --if-exists --exit-on-error -L /tmp/lista /r.dump'
```

## Operación

| Qué            | Comando                                                            |
| -------------- | ------------------------------------------------------------------ |
| Estado         | `docker compose -f docker-compose.prod.yml ps`                     |
| Logs de la API | `docker compose -f docker-compose.prod.yml logs -f api`            |
| Reiniciar      | `docker compose -f docker-compose.prod.yml restart`                |
| Detener        | `docker compose -f docker-compose.prod.yml down` (no toca la base) |

Los logs no contienen contraseñas, cookies ni tokens (se redactan).

## Lista de verificación

- [ ] `crear_rol_eco_app.sql` aplicado; `eco_app` tiene `UPDATE` y no `DELETE` sobre `eco_productos`.
- [ ] `.env` con `chmod 600`, `CORS_ORIGIN` = dominio con `https://`.
- [ ] `verificar-datos.js` termina en "Todo en orden".
- [ ] `.env` con `DB_REPORTES_USER` y `DB_REPORTES_PASSWORD`: el inicio muestra el dashboard (sin ellas, avisa
      «Los reportes no están configurados»).
- [ ] `api` y `web` "healthy"; `/api/salud` responde `ok`.
- [ ] El dominio abre la app por HTTPS y el login funciona.
- [ ] Puerto 8080 **no** accesible desde internet (solo `127.0.0.1`).
- [ ] Respaldo de `gestion` programado en cron.
- [ ] Recomendado (administrador de la base): revocar el privilegio por defecto de `ecofiltro_admin` sobre `eco_app` y
      crear índices en `eco_auditoria` (ver `docs/base-de-datos.md`).

## Modo temporal: la app conectada con un superusuario

Mientras no se apliquen los permisos de `eco_app`, la app puede conectarse con un superusuario (`DB_USER`).
Funciona, pero:

- **Riesgo:** un error o un acceso indebido a la app tiene control total de la base del bot.
- **Historial:** los cambios hechos con ese mismo usuario desde psql se atribuirían a la última persona que editó
  el registro en la app. Evita usar ese usuario fuera de la app mientras dure este modo.
- Las migraciones crean el esquema `gestion` y sus tablas **como propiedad de ese superusuario**.

**Para pasar a `eco_app` después** (como superusuario):

```sql
\i docs/sql/crear_rol_eco_app.sql
ALTER SCHEMA gestion OWNER TO eco_app;
ALTER TABLE gestion.usuarios OWNER TO eco_app;
ALTER TABLE gestion.sesiones OWNER TO eco_app;
ALTER TABLE gestion.migraciones OWNER TO eco_app;
```

Luego cambiar `DB_USER` / `DB_PASSWORD` a `eco_app` en `.env`, reiniciar la app y correr `verificar-datos.js`.
Las secuencias de las columnas identity cambian de dueño junto con su tabla.
