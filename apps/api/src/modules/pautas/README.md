# Módulo pautas

Promociones con vigencia (`eco_pautas`).

> Fase 2: solo el resumen para el selector de pauta en productos. La Fase 3 agrega listado completo y edición.

- **Tablas:** `eco_pautas` (lectura).
- **Endpoints:**
  - `GET /api/pautas/resumen` (cualquier rol) → `[{ id, codigo, nombre, descuentoPct, activo, vigente }]`.
- `vigente` = activa y dentro de `vigente_desde` / `vigente_hasta`, con la misma condición que `eco_v_catalogo`.
