# Módulo productos

Catálogo que el bot ofrece (`eco_productos`), con el precio final que calcula igual que `eco_contexto()`.

- **Tablas:** `eco_productos` (lectura y `UPDATE`); lectura de `eco_pautas` y `eco_v_catalogo`.
- **Endpoints:**
  - `GET /api/productos` y `GET /api/productos/:id` (cualquier rol).
  - `PUT /api/productos/:id` (permiso `productos:editar`) con todos los campos editables + `version`.
  - `PATCH /api/productos/:id/activo` `{ activo, version }` (permiso `productos:editar`).
- **Campos editables:** `precioBase`, `descuentoPct`, `estado`, `colores`, `palabrasClave`, `pautaId`, `orden`, `activo`.
  Código, nombre, tipo, familia, capacidad y `woo_id` son de solo lectura. No hay alta ni borrado.
- **Reglas:**
  - Validación en `@ecofiltro/shared` (`esquemaEditarProducto`): descuento 0–100, precio ≥ 0, máximo 2 decimales,
    listas sin vacíos ni repetidos.
  - `descuentoVigentePct` viene de `eco_v_catalogo`. Con una pauta inactiva o vencida es **0**, aunque el producto
    tenga su propio descuento: la web lo advierte.
  - `precioFinal` = `calcularPrecioFinal(precioBase, descuentoVigentePct)` (`@ecofiltro/shared/precios.js`).
    Una prueba de integración verifica que coincide con el `round()` de PostgreSQL.
  - **Concurrencia optimista:** si `version` no coincide (otra persona guardó antes) → 409 `CONFLICTO_VERSION`.
  - Guardar sin cambios no hace `UPDATE` (no genera auditoría vacía).
  - `actualizado_por` = correo del usuario; la auditoría la escribe el trigger `eco_productos_aud`.
