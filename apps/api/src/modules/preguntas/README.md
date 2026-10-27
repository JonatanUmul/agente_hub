# Módulo preguntas

Preguntas frecuentes del bot (`eco_preguntas_frecuentes`).

- **Tablas:** `eco_preguntas_frecuentes` (lectura, `INSERT`, `UPDATE`).
- **Endpoints** (lectura: cualquier rol; escritura: permiso `preguntas:editar` = admin, contenido):
  - `GET /api/preguntas` (orden: `orden, numero`, como `eco_v_preguntas_frecuentes`).
  - `GET /api/preguntas/siguiente-numero` → `{ numero }` sugerido para una pregunta nueva.
  - `GET /api/preguntas/:id`
  - `POST /api/preguntas` → 201. 409 `NUMERO_EN_USO`.
  - `PUT /api/preguntas/:id` (campos editables + `version`).
  - `PATCH /api/preguntas/:id/activo` `{ activo, version }`.
- **Cómo la usa el bot:** lee la vista `eco_v_preguntas_frecuentes` (solo activas). **No** forma parte de
  `eco_contexto()`.
- **Reglas de la app:**
  - El número no se cambia después de crear: la auditoría identifica la pregunta por su número (`registro_id`).
  - `modulos` solo admite los módulos de `eco_reglas_bot` (la base no lo restringe), al menos uno, sin repetidos.
  - No se borran preguntas: se desactivan (con confirmación).
  - Concurrencia optimista con `version` (409 `CONFLICTO_VERSION`) y sin `UPDATE` si no hay cambios.
