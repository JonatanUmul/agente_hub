# Ecofiltro Gestión

App web interna para administrar la base de datos que alimenta al bot de WhatsApp de Ecofiltro (n8n + HubSpot).
El bot lee las tablas `eco_*` en **cada mensaje**: un cambio guardado aquí se aplica en el siguiente mensaje del cliente.

La especificación completa está en `prompt_claude_code_app_gestion.md`. `index.html` en la raíz es un respaldo ajeno: no tocarlo.

## Stack

- Monorepo npm workspaces, **JavaScript ESM** (`.js` / `.jsx`), Node 22 (`nvm use`).
- `apps/api`: Fastify 5, `pg` con SQL escrito a mano (sin ORM), Zod 4 vía `fastify-type-provider-zod`.
- `apps/web`: React 18, Vite, React Router, TanStack Query, React Hook Form + Zod, Tailwind 4.
- `packages/shared` (`@ecofiltro/shared`): esquemas Zod compartidos. Única fuente de verdad de validaciones.
- Vitest: unitarias junto al código (`*.test.js`), integración en `apps/api/test/integracion/` contra PostgreSQL de Docker.
  `test/integracion/contexto.js` da app + `sesionCon(rol)`; `poolAdmin` (superusuario del contenedor) solo para limpiar.

## Comandos

```bash
nvm use                      # Node 22
npm run dev:db               # PostgreSQL 18 de desarrollo (127.0.0.1:5433), réplica del esquema eco_* + datos ficticios
                             # (docker/postgres/init/03_datos_desarrollo.sql; solo corre con volumen nuevo)
npm run migrar               # aplica migraciones de gestion (npm run migrar -- down revierte la última)
npm run crear-admin          # crea un admin por consola
npm run dev:api              # API en :3000 (lee .env de la raíz)
npm run dev:web              # Web en :5173, proxy /api → :3000
npm test                     # unitarias
npm run test:integracion -w @ecofiltro/api   # requiere dev:db
npm run lint && npm run format:check
npm run verificar-datos -w @ecofiltro/api   # solo lectura: ¿la app puede leer y guardar los datos de la base de .env?
```

Producción: `docker-compose.prod.yml` + `docs/despliegue.md`. Credenciales de `eco_admin` (solo para el administrador)
en `.env.admin`, nunca en `.env`. **Antes de correr pruebas de integración, confirmar que `.env` apunta a la base local.**

## Arquitectura

Organizado **por módulo de negocio**. Todo módulo de la API tiene la misma forma:

```
modules/<modulo>/
  <modulo>.routes.js      # solo HTTP: rutas, permisos, esquemas Zod de entrada/salida
  <modulo>.service.js     # reglas de negocio
  <modulo>.repository.js  # SOLO SQL parametrizado ($1, $2...)
  <modulo>.test.js
  index.js                # exporta el plugin
  README.md               # qué hace, qué tablas toca, qué endpoints expone
```

En la web: `features/<modulo>/{api.js, hooks.js, <Modulo>Page.jsx, <Modulo>Form.jsx}`. Todo fetch pasa por `src/lib/api.js`.

`crearApp({ config, pool })` en `apps/api/src/app.js` construye la app sin escuchar; `server.js` la arranca y las pruebas usan `app.inject()` con un pool falso.

Rutas: todo bajo `/api` exige sesión salvo `config: { publica: true }`. El permiso se declara con
`config: { permiso: 'productos:editar' }` (ver `packages/shared/src/permisos.js`); sin él se exige `ver`.
Los métodos que modifican exigen la cabecera `x-csrf-token` (el cliente web la agrega solo).

## Reglas de código

- Una responsabilidad por archivo, funciones cortas. Dominio en español (producto, pauta, regla), lo técnico en inglés (repository, service, routes).
- Comentarios breves que expliquen el **porqué**.
- Nada de lógica de negocio en rutas ni en componentes React.
- Errores de negocio con `AppError({ codigo, mensaje, estadoHttp })` (`src/lib/app-error.js`). Formato de respuesta único: `{ error: { codigo, mensaje, detalles? } }`.
- Claridad por encima de astucia: el dueño lee y entiende cada línea.

## Base de datos (existente, en producción)

- PostgreSQL **18.6**, base `ecofiltro_bot`. Esquema documentado en `docs/base-de-datos.md` (léelo antes de tocar un repositorio).
  La réplica de desarrollo es `docker/postgres/init/01_esquema_eco.sql`; si producción cambia, actualizarla. **No inventar columnas ni valores**: si algo no está claro, preguntar.
- **Nunca modificar ni borrar estructuras existentes.** Lo propio de la app va en el esquema `gestion`, con migraciones `node-pg-migrate` en `apps/api/migrations`.
- Toda consulta parametrizada. Nunca concatenar texto del usuario en SQL.
- Toda escritura en `eco_*`: dentro de `withTransaction` y llenando `actualizado_por` con el correo del usuario de la app
  (la auditoría registra `usuario_db = eco_app`; la persona real sale de `actualizado_por`).
- `pg` devuelve `numeric` y `bigint` como string: convertir en el repositorio.
- `precio_final` se calcula igual que `eco_contexto`: `round(precio_base * (1 - descuento_vigente_pct/100), 2)`.
  Usar siempre `calcularPrecioFinal` / `descuentoVigente` / `precioQueVeElBot` de `@ecofiltro/shared` (hay pruebas
  de paridad contra PostgreSQL). El descuento vigente real sale de la vista `eco_v_catalogo`.
- Ediciones de registros `eco_*` pasan por `editarConVersion` (`apps/api/src/lib/edicion.js`) y usan **concurrencia optimista**: el cliente envía `version` (`actualizado_en::text`);
  si no coincide → 409 `CONFLICTO_VERSION`. Guardar sin cambios no hace `UPDATE` (no ensucia la auditoría).
- Reglas de "qué ve el bot" viven en `@ecofiltro/shared` (`precioQueVeElBot`, `descuentoVigente`, `comoLoVeElBot`) y
  cada una tiene una prueba de integración contra `eco_v_catalogo` / `eco_contexto()`. Si cambias una, cambia su prueba.
- Vigencia en SQL: usar `vigenteSql(alias)` / `estadoVigenciaSql(alias)` de `apps/api/src/lib/vigencia.js`
  (misma condición que las vistas del bot).
- Mutaciones web: `useMutacionQueRecarga(fn, claves)` (`apps/web/src/lib/mutaciones.js`) recarga las consultas
  afectadas también tras un error (p. ej. 409).
- Formularios web: convertir texto del formulario con `z.any().transform(...).pipe(esquemaDeShared)`, así se valida con
  el mismo esquema que la API (Zod 4 no permite `.omit`/`.pick` sobre objetos con `.refine`).
- `eco_productos.codigo` es el **ItemCode** (uso interno: órdenes de venta, facturas). En la UI se llama "ItemCode".
- Historial (`eco_auditoria`): un cambio se atribuye a una persona (`actualizado_por`) **solo si `usuario_db = eco_app`**;
  si no, es "cambio directo en la base" (actualizado_por puede ser de una edición anterior).
- Cambios de estructura en la base del bot: scripts numerados en `docs/sql/00N_*.sql` (idempotentes, `SET LOCAL ROLE
eco_admin`), probados en una base desechable igual a producción, y replicados en `docker/postgres/init/`. Los
  aplica una persona en producción; la app nunca altera estructuras por su cuenta.
- Producto ↔ pautas: `eco_productos_pautas`; multimedia ↔ pautas: `eco_multimedia_pautas` (varias en ambos; las columnas
  `pauta_id` viejas guardan la primera por compatibilidad). Horarios: `eco_agentes_horario` /
  `eco_agentes_descanso` + `eco_agente_en_horario()`; `hubspot_agentes` es de n8n y la app solo la lee.
- Solo `precios_habilitados` y `promociones_habilitadas` son editables en `eco_configuracion`; las demás claves son de n8n.
- Preferir desactivar (`activo = false`) antes que borrar.
- No tocar tablas operativas del bot (`eventos`, `work`, `hubspot_*`, `*_locks`, `chat_asignados`, `menu*`...).
- Cambios sensibles (encender precios, cambiar un precio, desactivar una regla) piden confirmación en la UI.

## Seguridad (no negociable)

- La API usa el rol `eco_app` (ver `docs/sql/crear_rol_eco_app.sql`). La base nunca se expone a internet.
- Credenciales solo en `.env` (ignorado por git). Nunca contraseñas en código, logs ni commits. Los logs redactan cookies y cabeceras de autorización.
- Auth: argon2id, cookie httpOnly + Secure + SameSite=Strict, CSRF, rate limit y bloqueo temporal en login.
- Roles: `admin`, `comercial`, `contenido`, `lectura`. Permisos verificados **en la API**.
- Primer admin con `npm run crear-admin`, nunca con contraseña fija.

## Forma de trabajar

Por fases (ver especificación). Al terminar cada fase: correr pruebas, listar archivos creados, explicar el flujo de una petición de punta a punta, y **esperar visto bueno** antes de seguir.
