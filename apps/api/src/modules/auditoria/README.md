# Módulo auditoria

Historial de cambios de las tablas `eco_*` (solo lectura).

- **Tablas:** `eco_auditoria` (`SELECT`). La llena el trigger `eco_auditar()` en cada `INSERT`/`UPDATE`/`DELETE`.
- **Endpoint:** `GET /api/auditoria` (cualquier rol), filtros opcionales por query string:
  `tabla`, `operacion`, `origen` (`app` | `directo`), `registroId`, `usuario` (correo), `desde`, `hasta`,
  `antesDe` (cursor) y `limite` (1–200, por defecto 50). Respuesta: `{ entradas, siguiente }`, más recientes primero.
- **Cada entrada trae:** `etiqueta` (nombre/título/clave del registro), `cambios` (`[{ campo, antes, despues }]`;
  en `UPDATE` solo lo que cambió, sin `actualizado_en` / `actualizado_por`), `origen` y `usuarioApp`.
- **Quién hizo el cambio:**
  - `usuario_db = eco_app` → lo hizo la app; la persona es `actualizado_por` (la app siempre lo llena).
  - Otro rol → **cambio directo en la base**: no se atribuye a nadie, porque `actualizado_por` puede venir de una
    edición anterior. Se muestra el rol (`usuarioDb`).
- **`registro_id`** es `id` en la mayoría de tablas, `clave` en `eco_configuracion` y `numero` en preguntas.
- **Rendimiento:** `eco_auditoria` solo tiene índice en `id`. Con muchos registros, filtrar por tabla o fecha recorre
  la tabla. Si se vuelve lento, el administrador puede crear (fuera de la app) un índice en `(tabla, registro_id)` y
  otro en `creado_en`.
