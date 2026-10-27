# Módulo salud

Healthcheck para Docker y el proxy inverso.

- **Tablas:** ninguna (solo `SELECT 1`).
- **Endpoints:**
  - `GET /api/salud` → `200 { estado: 'ok', baseDatos: 'ok', hora }`,
    o `503 { estado: 'degradado', baseDatos: 'sin_conexion', hora }` si la base no responde.
- **Permisos:** público (no expone datos).
