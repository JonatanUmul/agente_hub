# Módulo mensajes (mensajes del bot)

Textos fijos que envía el bot (`eco_mensajes`), por clave del catálogo `eco_mensajes_tipos` (solo lectura). Con varias
versiones activas el bot las alterna; los de un solo uso toman la primera por `orden`; sin versiones activas, n8n usa
su texto por defecto. `eco_contexto(modulo)->'mensajes'` = `{ clave: [textos activos] }`.

- **Tablas:** `eco_mensajes_tipos` (lectura), `eco_mensajes` (lectura, alta, edición y borrado).
- **Endpoints** (leer: cualquier rol; escribir: permiso `mensajes:editar` = admin, contenido):
  - `GET /api/mensajes` — catálogo con sus versiones.
  - `POST /api/mensajes` `{ clave, texto, activo }` → 201, al final de la clave.
  - `PUT /api/mensajes/:id` `{ texto, activo, version, confirmar? }`, `PATCH /api/mensajes/:id/activo`.
  - `DELETE /api/mensajes/:id?version=…&confirmar=true` → 204.
  - `PUT /api/mensajes/orden` `[{ id, orden }]` — solo dentro de una clave.
- **Reglas** (`errorTextoMensaje` en `@ecofiltro/shared/mensajes.js`): 2 a 1000 caracteres; solo los comodines del tipo;
  sin Markdown (la `*negrita*` solo en la categoría Pauta); texto repetido en la clave → 409 `TEXTO_REPETIDO`.
  Un tipo con `varias = false` admite una sola versión activa. Dejar sin versiones activas `menu_bienvenida`,
  `inactividad_aviso`, `inactividad_cierre` o `asesor_pedir_nombre` → 409 `ULTIMA_VERSION` salvo `confirmar: true`.
