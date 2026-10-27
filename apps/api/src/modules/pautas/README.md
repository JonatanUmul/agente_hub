# Módulo pautas

Promociones con vigencia (`eco_pautas`).

- **Tablas:** `eco_pautas` (lectura, `INSERT`, `UPDATE`); cuenta filas de `eco_productos` y `eco_multimedia`.
- **Endpoints** (lectura: cualquier rol; escritura: permiso `pautas:editar` = admin, comercial):
  - `GET /api/pautas` → lista completa con `estadoVigencia` y conteos de productos / archivos asociados.
  - `GET /api/pautas/resumen` → `{ id, codigo, nombre, descuentoPct, activo, vigente }` para selectores.
  - `GET /api/pautas/:id`
  - `POST /api/pautas` → 201. 409 `CODIGO_EN_USO` si el código existe.
  - `PUT /api/pautas/:id` (todos los campos editables + `version`).
  - `PATCH /api/pautas/:id/activo` `{ activo, version }`.
- **Reglas:**
  - `vigente` / `estadoVigencia` usan la misma condición que `eco_v_catalogo` y `eco_contexto()`
    (`activo` y `vigente_desde <= now() < vigente_hasta`; fechas nulas = sin límite).
  - El código no se cambia después de crear. No se borran pautas: se desactivan.
  - "Hasta" posterior a "desde" (Zod y CHECK de la base). Descuento nulo o 0–100.
  - ⚠ Mientras una pauta no esté vigente, los productos asociados quedan **sin descuento**, también el propio
    (regla de `eco_v_catalogo`). `productosConDescuentoPropio` cuenta cuántos se ven afectados; la web lo advierte.
  - Concurrencia optimista con `version` (409 `CONFLICTO_VERSION`) y sin `UPDATE` si no hay cambios.
