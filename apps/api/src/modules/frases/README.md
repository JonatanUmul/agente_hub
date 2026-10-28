# Módulo frases (frases de cierre)

Frases con que el bot termina sus mensajes de WhatsApp (`eco_frases_cierre`). n8n elige una al azar, sin repetir
en la conversación, entre las activas de `GLOBAL` + el módulo (compras: `COMPRA`; atención: `SAC`) y de la
situación de la respuesta (`general`, `producto`, `problema`; si no hay de esa situación, usa `general`).
`eco_contexto(modulo)` las entrega en `frases_cierre`.

- **Tablas:** `eco_frases_cierre` (lectura, alta, edición y borrado); `eco_configuracion.cierre_automatico`.
- **Endpoints** (leer: cualquier rol; escribir: permiso `frases:editar` = admin, contenido):
  - `GET /api/frases-cierre?modulo=&situacion=&activo=` — orden igual al del bot (`orden`, `id`).
  - `POST /api/frases-cierre` → 201. Va al final de su grupo.
  - `PUT /api/frases-cierre/:id` (con `version`), `PATCH /api/frases-cierre/:id/activo`.
  - `DELETE /api/frases-cierre/:id?version=…` → 204. Antes anota `actualizado_por` para que el historial
    atribuya el borrado a quien lo hizo.
  - `PUT /api/frases-cierre/orden` `[{ id, orden }]` — solo dentro de un mismo módulo y situación.
  - `PUT /api/frases-cierre/cierre-automatico` `{ habilitado }` — interruptor `cierre_automatico`.
- **Reglas** (`@ecofiltro/shared/frases.js`): módulo y situación de los CHECK; frase de 3 a 200 caracteres
  (contados como PostgreSQL: un emoji = 1), una sola línea, sin Markdown (`**`, `#`, `__`, `` ` ``, enlaces,
  viñetas). Repetida en el mismo módulo y situación → 409 `FRASE_REPETIDA`. Concurrencia optimista (409
  `CONFLICTO_VERSION`) al editar, activar y borrar.
