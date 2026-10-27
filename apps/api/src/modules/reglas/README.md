# Módulo reglas

Instrucciones que el bot recibe en `eco_contexto()` (`eco_reglas_bot`).

- **Tablas:** `eco_reglas_bot` (lectura, `INSERT`, `UPDATE`).
- **Endpoints** (lectura: cualquier rol; escritura: permiso `reglas:editar` = admin, contenido):
  - `GET /api/reglas`, `GET /api/reglas/:id` (orden: `prioridad, id`, como `eco_v_reglas_activas`).
  - `POST /api/reglas` → 201. 409 `CODIGO_EN_USO`.
  - `PUT /api/reglas/:id` (campos editables + `version`).
  - `PATCH /api/reglas/:id/activo` `{ activo, version }`.
- **Cómo la usa el bot:**
  - Solo reglas activas y vigentes (`eco_v_reglas_activas`).
  - `eco_contexto(modulo)` incluye las `GLOBAL` + las del módulo pedido (`contextosDeRegla` en `@ecofiltro/shared`,
    verificado contra la función).
  - Entrega `codigo`, `destino`, `categoria` y `regla`. **El `titulo` no llega al bot**: es solo para identificarla aquí.
  - `destino` indica qué agente de n8n la usa (`ENRUTADOR`, `REDACTOR` o `TODOS`).
- **Reglas de la app:**
  - El código no se cambia después de crear. No se borran reglas: se desactivan (con confirmación).
  - "Hasta" posterior a "desde": la base no lo valida en esta tabla, la app sí.
  - Concurrencia optimista con `version` (409 `CONFLICTO_VERSION`) y sin `UPDATE` si no hay cambios.
