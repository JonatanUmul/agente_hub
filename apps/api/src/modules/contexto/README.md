# Módulo contexto

Vista previa "¿Qué ve el bot ahora?".

- **Base de datos:** `SELECT eco_contexto($1)` (`EXECUTE` sobre la función). No toca tablas directamente.
- **Endpoint:** `GET /api/contexto/:modulo` (cualquier rol), `modulo` ∈ `GLOBAL`, `SAC`, `COMPRA`, `DISTRIBUIDOR`,
  `PAUTAS`. Devuelve el JSON **sin transformar**, tal como lo recibe el bot.
- El esquema de respuesta (`esquemaContexto`) valida las claves conocidas y conserva cualquier campo nuevo que la
  función agregue en el futuro.
- Las preguntas frecuentes **no** forman parte de `eco_contexto()`: el bot las lee de `eco_v_preguntas_frecuentes`.
- ⚠ `configuracion` incluye todas las claves de `eco_configuracion` con su valor: cualquier rol de la app las ve.
