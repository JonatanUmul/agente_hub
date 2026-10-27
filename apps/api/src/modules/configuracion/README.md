# Módulo configuracion

Interruptores comerciales del bot en `eco_configuracion`.

- **Tablas:** `eco_configuracion` (lectura y `UPDATE` de `valor` y `actualizado_por`). La auditoría la llena el trigger.
- **Endpoints:**
  - `GET /api/configuracion/interruptores` (cualquier rol) → `[{ clave, descripcion, habilitado, actualizadoEn, actualizadoPor }]`.
  - `PUT /api/configuracion/interruptores/:clave` `{ habilitado }` (permiso `configuracion:editar`: admin, comercial).
- **Reglas:**
  - Solo `precios_habilitados` y `promociones_habilitadas` (`INTERRUPTORES` en `@ecofiltro/shared`). Las demás claves
    son parámetros técnicos de n8n y la app no las modifica.
  - Se guarda exactamente `'true'` / `'false'`: `eco_contexto()` solo reconoce `'true'`.
  - Si la clave no existe, 404: la app no crea claves.
  - La web pide confirmación antes de cada cambio; el bot lo aplica en el siguiente mensaje.
