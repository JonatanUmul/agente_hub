# Módulo multimedia

Imágenes, videos y artes de promociones que el bot envía (`eco_multimedia`), identificados por su ID de archivo de HubSpot.

- **Tablas:** `eco_multimedia` (lectura, `INSERT`, `UPDATE`); lectura de `eco_productos` y `eco_pautas`.
- **Endpoints** (lectura: cualquier rol; escritura: permiso `multimedia:editar` = admin, comercial):
  - `GET /api/multimedia`, `GET /api/multimedia/:id`
  - `POST /api/multimedia` → 201. 409 `ARCHIVO_DUPLICADO` si ya existe el mismo `tipo` + `hubspotFileId`.
  - `PUT /api/multimedia/:id` (campos editables + `version`). `tipo` y `hubspotFileId` no se cambian: para otro
    archivo, se crea un registro nuevo y se desactiva el anterior.
  - `PATCH /api/multimedia/:id/activo` `{ activo, version }`.
- **Cómo lo usa el bot** (`eco_contexto()`, ver `comoLoVeElBot` en `@ecofiltro/shared`):
  - `imagen` y `video` activos → lista general (`multimedia`), con producto, color y tema.
  - Cualquier archivo activo con `pauta_id` → `imagenes` de esa pauta, solo si la pauta está vigente y las
    promociones encendidas.
  - ⚠ `promocion` **sin pauta** no llega nunca al bot. La web lo advierte.
- **Límites:** la app no verifica que el ID exista en HubSpot (no tiene acceso a su API). No se borran registros.
- Concurrencia optimista con `version` (409 `CONFLICTO_VERSION`) y sin `UPDATE` si no hay cambios.
