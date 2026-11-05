# Módulo pautas

Promociones con vigencia (`eco_pautas`).

- **Tablas:** `eco_pautas` (lectura, `INSERT`, `UPDATE`); `eco_productos_pautas` y `eco_multimedia_pautas`
  (modelos y archivos de la pauta); `eco_productos.pauta_id` y `eco_multimedia.pauta_id` (pauta principal).
- **Endpoints** (lectura: cualquier rol; escritura: permiso `pautas:editar` = admin, comercial):
  - `GET /api/pautas` → lista completa con `estadoVigencia` y conteos de productos / archivos asociados.
  - `GET /api/pautas/resumen` → `{ id, codigo, nombre, descuentoPct, activo, vigente, aplicaTodos, productoIds,
multimediaIds }` para selectores.
  - `GET /api/pautas/:id`
  - `POST /api/pautas` → 201. 409 `CODIGO_EN_USO` si el código existe.
  - `PUT /api/pautas/:id` (todos los campos editables + `aplicaTodos`, `productoIds`, `multimediaIds` + `version`).
  - `PATCH /api/pautas/:id/activo` `{ activo, version }`.
- **Reglas:**
  - `vigente` / `estadoVigencia` usan la misma condición que `eco_v_catalogo` y `eco_contexto()`
    (`activo` y `vigente_desde <= now() < vigente_hasta`; fechas nulas = sin límite).
  - El código no se cambia después de crear. No se borran pautas: se desactivan.
  - "Hasta" posterior a "desde" (Zod y CHECK de la base). Descuento nulo o 0–100.
  - ⚠ Mientras una pauta no esté vigente, los productos asociados quedan **sin descuento**, también el propio
    (regla de `eco_v_catalogo`). `productosConDescuentoPropio` cuenta cuántos se ven afectados; la web lo advierte.
  - Concurrencia optimista con `version` (409 `CONFLICTO_VERSION`) y sin `UPDATE` si no hay cambios.
- **Modelos y archivos desde la pauta** (misma transacción y misma `version` que la pauta):
  - Se borran solo los enlaces quitados y se insertan los nuevos con `actualizado_por`.
  - Con `aplicaTodos` los modelos no se tocan: vuelven si se apaga.
  - Lo nuevo debe existir y estar activo (400 `ASOCIADO_NO_VALIDO`); lo inactivo ya asociado se conserva.
  - `eco_productos.pauta_id` = la primera pauta del producto (igual que desde Productos).
  - `eco_multimedia.pauta_id`: un archivo agregado sin principal toma esta pauta; uno quitado cuya principal era
    esta pasa a su otra pauta de menor id o a `NULL`. La vista previa usa la misma regla (`principalTrasCambio`).
  - Un archivo con solo `pauta_id` = la pauta (sin fila en `eco_multimedia_pautas`) cuenta como de la pauta.
