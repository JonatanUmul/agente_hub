# Prompt para Claude Code — App de Gestión del Bot Ecofiltro

> Copia todo lo que está debajo de la línea en tu primera conversación con Claude Code,
> dentro de la carpeta vacía del proyecto (`ecofiltro-gestion`).

---

Vamos a construir **Ecofiltro Gestión**, una app web interna para administrar la base de datos que alimenta al bot de WhatsApp de Ecofiltro (n8n + HubSpot). Soy desarrollador y quiero **leer y entender cada parte del código**, así que la claridad está por encima de la astucia.

## Objetivo

Que Comercial y Administración cambien, sin tocar SQL ni n8n:
- Productos: precio base, % de descuento, estado (disponible / agotado / descontinuado), colores, palabras clave, pauta asociada, orden, activo.
- Interruptores comerciales: `precios_habilitados` y `promociones_habilitadas` (tabla `eco_configuracion`).
- Pautas / promociones con vigencia (desde / hasta) y % de descuento.
- Reglas del bot (`eco_reglas_bot`): crear, editar, activar / desactivar, por módulo y destino.
- Preguntas frecuentes (`eco_preguntas_frecuentes`).
- Multimedia (`eco_multimedia`): imágenes, videos y artes de promociones con su ID de archivo de HubSpot.
- Historial de cambios (`eco_auditoria`): quién cambió qué, cuándo, antes y después.
- Vista previa: botón "¿Qué ve el bot ahora?" que ejecuta `SELECT eco_contexto('SAC')` / `('COMPRA')` y lo muestra legible.

El bot lee estas tablas en cada mensaje: **un cambio guardado en la app se aplica en el siguiente mensaje del cliente**. Por eso cada formulario debe validar bien y pedir confirmación en cambios sensibles (encender precios, cambiar un precio, desactivar una regla).

## Stack (obligatorio)

- **Monorepo** con npm workspaces, todo en **Javascript**.
- `apps/api`: **Node.js 22 + Fastify**, acceso a PostgreSQL con **`pg` (node-postgres) y SQL escrito a mano** en una capa de repositorio (nada de ORM: quiero ver y entender cada consulta). Validación con **Zod**.
- `apps/web`: **React 18 + Vite**, **React Router**, **TanStack Query** para datos del servidor, **React Hook Form + Zod** para formularios, **Tailwind CSS** para estilos. Componentes simples, sin librerías de UI pesadas.
- `packages/shared`: esquemas Zod y tipos compartidos entre API y web (una sola fuente de verdad para las validaciones).
- Pruebas: **Vitest** (unitarias de servicios) y pruebas de integración de la API contra una base PostgreSQL de prueba en Docker.
- **Docker Compose** para desarrollo y para producción.

## Arquitectura modular (lo más importante)

Organizar por **módulo de negocio**, no por tipo de archivo. Cada módulo es independiente y sigue siempre la misma forma, para que agregar uno nuevo sea copiar el patrón:

```
apps/api/src/
  app.ts                 # crea Fastify, registra plugins y módulos
  server.ts              # arranque
  config/env.ts          # variables de entorno validadas con Zod (falla al arrancar si falta algo)
  db/pool.ts             # un único Pool de pg
  db/transaction.ts      # helper withTransaction(fn)
  plugins/               # auth, manejo de errores, logs, rate limit, cabeceras de seguridad
  modules/
    productos/
      productos.routes.ts      # solo HTTP: rutas, permisos, validación de entrada/salida
      productos.service.ts     # reglas de negocio (ej. no permitir descuento > 100, calcular precio final)
      productos.repository.ts  # SOLO SQL parametrizado ($1, $2...), devuelve objetos tipados
      productos.test.ts
      index.ts                 # exporta el plugin del módulo
    configuracion/  pautas/  reglas/  preguntas/  multimedia/  auditoria/  contexto/  auth/  usuarios/

apps/web/src/
  app/                   # router, layout, proveedor de TanStack Query, sesión
  lib/api.ts             # cliente fetch único (maneja errores y 401)
  components/            # componentes genéricos (Tabla, Formulario, Modal de confirmación, Toggle)
  features/
    productos/  (api.ts · hooks.ts · ProductosPage.tsx · ProductoForm.tsx)
    configuracion/ pautas/ reglas/ preguntas/ multimedia/ auditoria/ contexto/ auth/
```

Reglas de código:
- Una responsabilidad por archivo; funciones cortas; nombres en español para el dominio (producto, pauta, regla) e inglés para lo técnico (repository, service, routes).
- Comentarios breves que expliquen el **porqué**, no el qué.
- Nada de lógica de negocio en rutas ni en componentes React.
- Errores con una clase `AppError` (código, mensaje para el usuario, estado HTTP) y un manejador central.
- Cada módulo tiene un `README.md` corto: qué hace, qué tablas toca, qué endpoints expone.

## Base de datos existente (NO la recrees)

PostgreSQL 16, base `ecofiltro_bot`, ya creada y en producción. **Antes de escribir código, inspecciona el esquema real** con `information_schema` / `\d` y documenta lo que encuentres en `docs/base-de-datos.md`. Resumen de lo que existe:

- `eco_configuracion (clave PK, valor, tipo, descripcion, actualizado_en, actualizado_por)` — incluye `precios_habilitados`, `promociones_habilitadas`, `moneda`, `max_fotos`, etc.
- `eco_productos (id, codigo UNIQUE, nombre, tipo equipo|accesorio|repuesto, familia, capacidad_litros, colores text[], estado disponible|agotado|descontinuado, precio_base, descuento_pct, pauta_id → eco_pautas, woo_id, palabras_clave text[], orden, activo, notas_internas, timestamps, actualizado_por)`
- `eco_pautas (id, codigo UNIQUE, nombre, mensaje_cliente, descuento_pct, palabras_clave text[], vigente_desde, vigente_hasta, activo, ...)`
- `eco_multimedia (id, tipo imagen|video|promocion, hubspot_file_id, descripcion, producto_id, color, tema, pauta_id, orden, activo, UNIQUE(tipo, hubspot_file_id))`
- `eco_reglas_bot (id, codigo UNIQUE, modulo GLOBAL|SAC|COMPRA|DISTRIBUIDOR|PAUTAS, destino TODOS|ENRUTADOR|REDACTOR, categoria, titulo, regla, prioridad, activo, vigente_desde, vigente_hasta, ...)`
- `eco_preguntas_frecuentes (id, numero UNIQUE, pregunta, tema, palabras_clave text[], respuesta, modulos text[], orden, activo, ...)`
- `eco_auditoria (id, tabla, operacion, registro_id, antes jsonb, despues jsonb, usuario_db, creado_en)` — se llena sola con triggers.
- Vistas: `eco_v_catalogo` (precio y descuento vigente), `eco_v_reglas_activas`, `eco_v_preguntas_frecuentes`. Función `eco_contexto(modulo)`.
- Hay otras tablas operativas del bot (`eventos`, `work`, `hubspot_*`, `*_locks`, `chat_asignados`, `menu`, `menu_opciones`...). **La app no las toca** (solo lectura de `eventos` si más adelante hacemos reportes).

Reglas para la base:
- **No modificar ni borrar estructuras existentes.** Lo nuevo de la app va en un esquema propio `gestion` (usuarios, sesiones) con migraciones versionadas (`node-pg-migrate`) en `apps/api/migrations`.
- Toda consulta parametrizada. Nunca concatenar texto del usuario en SQL.
- Cada escritura en `eco_*` debe llenar `actualizado_por` con el correo del usuario de la app, y ejecutarse en transacción.
- Preferir "desactivar" (`activo = false`) antes que borrar.

## Seguridad (no negociable)

- La app se conecta con un usuario PostgreSQL propio **`eco_app`** (lo crea el administrador; prepara el SQL en `docs/sql/crear_rol_eco_app.sql`): `SELECT/INSERT/UPDATE` sobre las tablas `eco_*`, `SELECT` sobre `eco_auditoria` y las vistas, `EXECUTE` sobre `eco_contexto`, y dueño del esquema `gestion`. Sin acceso a las tablas operativas del bot.
- La base **nunca** se expone a internet: la API se conecta por la red interna de Docker.
- Credenciales solo en `.env` (con `.env.example` sin valores reales). `.env` en `.gitignore`. Nunca escribir contraseñas en código, logs ni commits.
- Autenticación con usuario y contraseña (hash **argon2id**), sesión en **cookie httpOnly, Secure, SameSite=Strict**, expiración configurable, protección CSRF, **rate limit** en el login y bloqueo temporal tras intentos fallidos.
- Roles: `admin` (todo, incluye usuarios), `comercial` (productos, precios, pautas, interruptores, multimedia), `contenido` (reglas y preguntas frecuentes), `lectura` (solo ver). Permisos verificados **en la API**, no solo ocultando botones.
- Cabeceras de seguridad (`@fastify/helmet`), CORS restringido al dominio de la app, validación Zod de toda entrada y salida, logs sin datos sensibles.
- Primer usuario admin creado con un comando de consola (`npm run crear-admin`), nunca con una contraseña fija en el código.

## Forma de trabajar

Trabaja **por fases**. Al terminar cada fase: corre pruebas, muéstrame qué archivos creaste y explícame en pocas líneas cómo fluye una petición de punta a punta. Espera mi visto bueno antes de la siguiente fase.

1. **Fase 0 — Base:** monorepo, JavaScript, lint/format, Docker Compose de desarrollo (PostgreSQL de prueba con una copia del esquema `eco_*`), `config/env.ts`, pool, manejador de errores, healthcheck, `CLAUDE.md` del proyecto con estas reglas y `docs/base-de-datos.md`.
2. **Fase 1 — Autenticación y usuarios** (esquema `gestion`, migraciones, login, roles, `crear-admin`).
3. **Fase 2 — Productos e interruptores comerciales** (tabla con filtros, edición, precio final calculado, confirmación al encender precios).
4. **Fase 3 — Pautas y multimedia.**
5. **Fase 4 — Reglas del bot y preguntas frecuentes.**
6. **Fase 5 — Auditoría y vista previa de `eco_contexto`.**
7. **Fase 6 — Producción:** Dockerfiles multi-stage, Compose de producción detrás del proxy existente, guía de despliegue en `docs/despliegue.md`, respaldo.

No inventes columnas ni valores: si algo no está claro en el esquema, pregúntame.
