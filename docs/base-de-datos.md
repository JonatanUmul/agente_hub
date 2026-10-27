# Base de datos `ecofiltro_bot`

Inspeccionada el **2026-10-26**, en solo lectura y como `eco_app`, con
[`sql/inspeccionar_esquema.sql`](sql/inspeccionar_esquema.sql) y [`sql/inspeccionar_catalogo.sql`](sql/inspeccionar_catalogo.sql).

- **Motor:** PostgreSQL **18.6** (Debian). La especificación decía 16; el Docker de desarrollo usa 18.
- **Esquemas:** solo `public`. El esquema `gestion` aún no existe.
- **Extensiones:** solo `plpgsql`.
- La réplica de desarrollo ([`docker/postgres/init/01_esquema_eco.sql`](../docker/postgres/init/01_esquema_eco.sql))
  se comparó contra producción y es **idéntica** en columnas, restricciones, índices, triggers, vistas, funciones y dueños.

## Tablas que administra la app

Todas son propiedad de `eco_admin`. Las columnas `actualizado_en` las llena el trigger `*_upd` (no hace falta enviarlas).
Las columnas `actualizado_por` son `text` sin restricción: la app debe llenarlas con el correo del usuario.

### `eco_configuracion` — interruptores y parámetros

| Columna           | Tipo        | Nulo | Por defecto                                                        |
| ----------------- | ----------- | ---- | ------------------------------------------------------------------ |
| `clave` **PK**    | text        | no   |                                                                    |
| `valor`           | text        | sí   |                                                                    |
| `tipo`            | text        | no   | `'texto'` · CHECK `booleano`, `entero`, `decimal`, `texto`, `json` |
| `descripcion`     | text        | sí   |                                                                    |
| `actualizado_en`  | timestamptz | no   | `now()`                                                            |
| `actualizado_por` | text        | sí   |                                                                    |

- `valor` es **texto siempre**; `tipo` indica cómo interpretarlo. La app debe validar `valor` según `tipo`.
- `eco_contexto` interpreta los booleanos con `lower(valor) = 'true'`: cualquier otro texto (`'si'`, `'1'`) cuenta como **falso**.
  Guardar siempre `'true'` / `'false'`.
- Claves usadas por `eco_contexto`: `precios_habilitados`, `promociones_habilitadas`, `moneda` (por defecto `'Q'`).
  La especificación menciona además `max_fotos`. **No se pudieron listar las claves reales** (`eco_app` aún no tiene SELECT).
- Auditoría: `registro_id` = `clave`.

### `eco_productos`

`codigo` guarda el **ItemCode** del producto: el código interno con el que se crean órdenes de venta y facturas.
La app lo muestra como "ItemCode", permite buscarlo y copiarlo, y no lo modifica (`eco_contexto()` lo entrega al bot).

| Columna                       | Tipo             | Nulo | Por defecto / restricción                                       |
| ----------------------------- | ---------------- | ---- | --------------------------------------------------------------- |
| `id` **PK**                   | integer (serial) | no   | `eco_productos_id_seq`                                          |
| `codigo`                      | text             | no   | UNIQUE                                                          |
| `nombre`                      | text             | no   |                                                                 |
| `tipo`                        | text             | no   | CHECK `equipo`, `accesorio`, `repuesto`                         |
| `familia`                     | text             | no   | índice `eco_productos_familia_idx`                              |
| `capacidad_litros`            | numeric(6,2)     | sí   |                                                                 |
| `colores`                     | text[]           | no   | `'{}'`                                                          |
| `estado`                      | text             | no   | `'disponible'` · CHECK `disponible`, `agotado`, `descontinuado` |
| `precio_base`                 | numeric(10,2)    | sí   | CHECK `>= 0`                                                    |
| `descuento_pct`               | numeric(5,2)     | no   | `0` · CHECK 0–100                                               |
| `pauta_id`                    | integer          | sí   | FK → `eco_pautas(id)` ON DELETE SET NULL                        |
| `woo_id`                      | integer          | sí   | UNIQUE                                                          |
| `palabras_clave`              | text[]           | no   | `'{}'`                                                          |
| `orden`                       | integer          | no   | `100`                                                           |
| `activo`                      | boolean          | no   | `true`                                                          |
| `notas_internas`              | text             | sí   |                                                                 |
| `creado_en`, `actualizado_en` | timestamptz      | no   | `now()`                                                         |
| `actualizado_por`             | text             | sí   |                                                                 |

### `eco_pautas` — promociones con vigencia

| Columna                          | Tipo             | Nulo   | Por defecto / restricción                              |
| -------------------------------- | ---------------- | ------ | ------------------------------------------------------ |
| `id` **PK**                      | integer (serial) | no     |                                                        |
| `codigo`                         | text             | no     | UNIQUE                                                 |
| `nombre`                         | text             | no     |                                                        |
| `mensaje_cliente`                | text             | sí     |                                                        |
| `descuento_pct`                  | numeric(5,2)     | **sí** | CHECK nulo o 0–100                                     |
| `palabras_clave`                 | text[]           | no     | `'{}'`                                                 |
| `vigente_desde`, `vigente_hasta` | timestamptz      | sí     | CHECK `vigente_hasta > vigente_desde` si ambas existen |
| `activo`                         | boolean          | no     | `true`                                                 |
| `creado_en`, `actualizado_en`    | timestamptz      | no     | `now()`                                                |
| `actualizado_por`                | text             | sí     |                                                        |

### `eco_multimedia`

| Columna                       | Tipo             | Nulo | Por defecto / restricción                            |
| ----------------------------- | ---------------- | ---- | ---------------------------------------------------- |
| `id` **PK**                   | integer (serial) | no   |                                                      |
| `tipo`                        | text             | no   | CHECK `imagen`, `video`, `promocion`                 |
| `hubspot_file_id`             | text             | no   | UNIQUE (`tipo`, `hubspot_file_id`)                   |
| `descripcion`                 | text             | no   |                                                      |
| `producto_id`                 | integer          | sí   | FK → `eco_productos(id)` ON DELETE SET NULL · índice |
| `color`, `tema`               | text             | sí   |                                                      |
| `pauta_id`                    | integer          | sí   | FK → `eco_pautas(id)` ON DELETE SET NULL             |
| `orden`                       | integer          | no   | `100`                                                |
| `activo`                      | boolean          | no   | `true`                                               |
| `creado_en`, `actualizado_en` | timestamptz      | no   | `now()`                                              |
| `actualizado_por`             | text             | sí   |                                                      |

### `eco_reglas_bot`

| Columna                          | Tipo             | Nulo | Por defecto / restricción                                              |
| -------------------------------- | ---------------- | ---- | ---------------------------------------------------------------------- |
| `id` **PK**                      | integer (serial) | no   |                                                                        |
| `codigo`                         | text             | no   | UNIQUE                                                                 |
| `modulo`                         | text             | no   | `'GLOBAL'` · CHECK `GLOBAL`, `SAC`, `COMPRA`, `DISTRIBUIDOR`, `PAUTAS` |
| `destino`                        | text             | no   | `'TODOS'` · CHECK `TODOS`, `ENRUTADOR`, `REDACTOR`                     |
| `categoria`                      | text             | no   | (texto libre, sin CHECK)                                               |
| `titulo`                         | text             | no   |                                                                        |
| `regla`                          | text             | no   |                                                                        |
| `prioridad`                      | integer          | no   | `50` (menor = primero)                                                 |
| `activo`                         | boolean          | no   | `true`                                                                 |
| `vigente_desde`, `vigente_hasta` | timestamptz      | sí   | **sin** CHECK de orden (a diferencia de pautas)                        |
| `creado_en`, `actualizado_en`    | timestamptz      | no   | `now()`                                                                |
| `actualizado_por`                | text             | sí   |                                                                        |

### `eco_preguntas_frecuentes`

| Columna                       | Tipo             | Nulo | Por defecto / restricción                |
| ----------------------------- | ---------------- | ---- | ---------------------------------------- |
| `id` **PK**                   | integer (serial) | no   |                                          |
| `numero`                      | integer          | no   | UNIQUE                                   |
| `pregunta`                    | text             | no   |                                          |
| `tema`                        | text             | sí   |                                          |
| `palabras_clave`              | text[]           | no   | `'{}'`                                   |
| `respuesta`                   | text             | no   |                                          |
| `modulos`                     | text[]           | no   | `ARRAY['GLOBAL']` (sin CHECK de valores) |
| `orden`                       | integer          | no   | `100`                                    |
| `activo`                      | boolean          | no   | `true`                                   |
| `creado_en`, `actualizado_en` | timestamptz      | no   | `now()`                                  |
| `actualizado_por`             | text             | sí   |                                          |

- Auditoría: `registro_id` = `numero` (no `id`).

### `eco_auditoria` (solo lectura para la app)

| Columna            | Tipo               | Nulo | Por defecto                              |
| ------------------ | ------------------ | ---- | ---------------------------------------- |
| `id` **PK**        | bigint (bigserial) | no   | `eco_auditoria_id_seq`                   |
| `tabla`            | text               | no   |                                          |
| `operacion`        | text               | no   | `INSERT` / `UPDATE` / `DELETE` (`TG_OP`) |
| `registro_id`      | text               | sí   |                                          |
| `antes`, `despues` | jsonb              | sí   | fila completa (`to_jsonb`)               |
| `usuario_db`       | text               | no   | `CURRENT_USER`                           |
| `creado_en`        | timestamptz        | no   | `now()`                                  |

## Triggers

Cada una de las 6 tablas tiene dos:

- `<tabla>_upd` — `BEFORE UPDATE` → `eco_set_updated_at()`: pone `actualizado_en = now()`.
- `<tabla>_aud` — `AFTER INSERT OR UPDATE OR DELETE` → `eco_auditar('<columna id>')`: escribe en `eco_auditoria`.
  La columna id es `clave` en configuración, `numero` en preguntas y `id` en las demás.

## Vistas y función que lee el bot

- **`eco_v_catalogo`**: productos `activo` con `descuento_vigente_pct`:
  - sin pauta → `descuento_pct` del producto;
  - con pauta activa y vigente → `GREATEST(descuento_pct, pauta.descuento_pct)`;
  - con pauta **inactiva o vencida → 0** (regla original; cambiada por docs/sql/002, ver abajo).
- **`eco_v_reglas_activas`**: reglas activas y dentro de vigencia, ordenadas por `prioridad, id`.
- **`eco_v_preguntas_frecuentes`**: preguntas activas, ordenadas por `orden, numero`.
- **`eco_contexto(p_modulo text DEFAULT 'GLOBAL') → jsonb`** (`STABLE`, no `SECURITY DEFINER`): devuelve
  `generado_en`, `modulo`, `precios_habilitados`, `promociones_habilitadas`, `configuracion` (todas las claves),
  `reglas` (módulo `GLOBAL` + el pedido), `catalogo`, `pautas` (solo si hay promociones) y `multimedia`
  (`imagen` y `video`; las `promocion` salen dentro de cada pauta).
  - Precio y moneda solo aparecen si `precios_habilitados`; descuento solo si además `promociones_habilitadas`.
  - `precio_final = round(precio_base * (1 - descuento_vigente_pct/100), 2)`. La app debe calcularlo **igual**.
  - ⚠ `configuracion` incluye **todas** las claves y valores de `eco_configuracion`: nunca guardar ahí nada secreto.

## Roles y permisos (estado actual)

| Rol                            | Login | Notas                                                                                                 |
| ------------------------------ | ----- | ----------------------------------------------------------------------------------------------------- |
| `eco_admin`                    | sí    | Dueño de la base y de todos los objetos `eco_*`.                                                      |
| `eco_n8n`                      | sí    | El bot: `SELECT` sobre tablas y vistas `eco_*`, `EXECUTE` sobre `eco_contexto`, `CREATE` en `public`. |
| `eco_app`                      | sí    | **Ya existe.** Solo `CONNECT` a la base; ningún permiso sobre `eco_*`. `NOINHERIT`.                   |
| `ecofiltro`, `ecofiltro_admin` | sí    | Superusuarios.                                                                                        |
| `ecofiltro_datacenter_owner`   | no    |                                                                                                       |

- `eco_contexto` tiene `EXECUTE` para `PUBLIC`.
- ⚠ Privilegio por defecto existente: `ecofiltro_admin` otorga a `eco_app` **`INSERT/SELECT/UPDATE/DELETE`** sobre cualquier
  tabla nueva que cree en `public`. Así, `eco_app` podría ganar acceso a tablas operativas futuras. Ver la recomendación en
  [`sql/crear_rol_eco_app.sql`](sql/crear_rol_eco_app.sql).

### Por qué `eco_app` necesita `INSERT` en `eco_auditoria`

`eco_auditar()` **no** es `SECURITY DEFINER`, así que inserta en `eco_auditoria` con los permisos de quien hace el cambio.
Con solo `SELECT` (lo que pedía la especificación), cualquier escritura de la app fallaría. Convertirla en
`SECURITY DEFINER` no sirve: `usuario_db` usa `CURRENT_USER` y pasaría a decir `eco_admin` en todos los registros.
Por eso el script otorga `INSERT` (sin `UPDATE`/`DELETE`) y `USAGE` sobre la secuencia.

## Consecuencias para la app

- **Quién hizo el cambio:** `usuario_db` siempre dirá `eco_app`. La persona real se obtiene de
  `despues->>'actualizado_por'` (o `antes->>` en un `DELETE`). Por eso es obligatorio llenar `actualizado_por` en cada escritura.
- **Tipos de `pg`:** `numeric` llega como **string** (`'100.00'`), `bigint` también. Los repositorios deben convertirlos explícitamente.
- `woo_id` es UNIQUE pero admite nulos: varios productos pueden no tenerlo.
- `eco_reglas_bot` no impide que `vigente_hasta < vigente_desde`: lo valida la app.
- `eco_preguntas_frecuentes.modulos` no valida sus valores: la app los restringe a los módulos de `eco_reglas_bot.modulo`.

- **Multimedia en `eco_contexto()`:** la lista `multimedia` solo incluye `imagen` y `video` activos. Las `imagenes` de
  una pauta incluyen **cualquier** archivo activo con ese `pauta_id` (no solo `promocion`). Un archivo `promocion` sin
  pauta nunca llega al bot. Regla replicada en `comoLoVeElBot()` de `@ecofiltro/shared` y verificada contra la función.

- **Reglas en `eco_contexto(modulo)`:** solo activas y vigentes, las `GLOBAL` más las del módulo pedido. Se entregan
  `codigo`, `destino`, `categoria` y `regla`; el `titulo` no llega al bot. Replicado en `contextosDeRegla()`.
- **Preguntas frecuentes:** no forman parte de `eco_contexto()`; el bot las lee de `eco_v_preguntas_frecuentes`.

- **Índices de `eco_auditoria`:** solo tiene la llave primaria. El historial de la app filtra por tabla, registro y
  fecha; si la tabla crece mucho, conviene que el administrador cree (fuera de la app) índices en
  `(tabla, registro_id)` y en `creado_en`.

## Cambios aplicados por la app (docs/sql/002_pautas_multiples_y_horarios.sql)

- **`eco_productos_pautas`** (`producto_id`, `pauta_id`, PK compuesta): un producto puede tener varias pautas.
  `eco_productos.pauta_id` se conserva por compatibilidad (la app guarda ahí la primera pauta), pero la fuente de
  verdad es la tabla nueva.
- **`eco_v_catalogo`** (misma forma): `descuento_vigente_pct` = el mayor entre el descuento propio y el de las pautas
  **vigentes**. Las pautas vencidas o inactivas ya no anulan el descuento propio. `pauta_nombre` = la pauta vigente
  de mayor descuento.
- **`eco_agentes_horario`** (`agente_id`, `dia_semana` ISO 1–7, `hora_inicio`, `hora_fin` exclusiva, `24:00` = fin
  del día) y **`eco_agentes_descanso`** (`agente_id`, `desde`, `hasta`, `motivo`). `agente_id` = `hubspot_agentes.id`
  sin llave foránea (n8n sincroniza esa tabla).
- **`eco_agente_en_horario(agente_id, momento DEFAULT now())`** → boolean, hora de Guatemala; un descanso gana sobre
  el horario semanal. **`eco_v_agentes_en_horario`**: agentes no archivados en horario ahora.
- Permisos: `eco_app` administra lo nuevo (con `DELETE` en estas tres tablas); `eco_n8n` solo lee.

## Tablas operativas del bot

No fueron inspeccionadas (no son `eco_*`). La app **no las toca** y `eco_app` no tiene permisos sobre ellas.

## Pendiente de confirmar

1. Lista real de claves de `eco_configuracion` y su `tipo`. Se podrá leer cuando se apliquen los permisos.
2. Si los productos asociados a una pauta vencida deben perder su descuento propio (comportamiento actual de la vista).
