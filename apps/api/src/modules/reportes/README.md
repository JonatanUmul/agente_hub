# Módulo reportes

Dashboard de cómo está funcionando el bot (docs/reportes-indicadores.md). **Solo lectura.**

- **Conexión:** pool aparte con el rol `eco_reportes` (docs/sql/rol_eco_reportes.sql): `SELECT` solo sobre las columnas
  que usan las consultas, transacciones de solo lectura y 15 s máximo por consulta. Sin `DB_REPORTES_USER`, los
  endpoints responden 503 y el resto de la app funciona igual. `eco_app` sigue sin acceso a las tablas operativas.
- **Tablas:** `eventos`, `hubspot_webhook_log`, `chat_asignados`, `conversation_inactivity_control`,
  `agent_hours_notice_control`, `hubspot_agentes` y catálogos `eco_*` para los nombres.
- **Endpoints** (filtros por query: `desde`, `hasta` obligatorios —máximo 365 días—, `modulo`, `bandeja`, `agente`):
  - `GET /api/reportes` (todos los roles) → tarjetas con valor, periodo anterior y variación %, series por día,
    mapa de calor día × hora, módulos, agentes, fuera de horario, pautas, preguntas y multimedia.
  - `GET /api/reportes/detalle` → una fila por conversación (máx. 500), **sin datos del cliente**.
  - `GET /api/reportes/exportar/:tabla` (permiso `reportes:exportar` = admin, comercial) → CSV (`;`, UTF-8 con BOM,
    protegido contra inyección de fórmulas). Tablas: `por-dia`, `agentes`, `pautas`, `preguntas`, `multimedia`, `detalle`.
- **Filtros:** definen el conjunto de conversaciones del bot (`conv`). Los indicadores de otras tablas (mensajes de la
  bandeja, avisos) se limitan a ese conjunto solo cuando hay algún filtro; sin filtros cuentan toda la bandeja.
- **Caché:** 5 minutos en memoria por combinación de filtros (máx. 100 entradas).
- **Privacidad:** nunca se leen `message`, `respuesta_n8n`, `resumen_ia`, `name`, `sesionid_cliente`, `createdby` ni
  `payload` (el rol ni siquiera tiene permiso). Las pruebas verifican que no aparezcan en respuestas ni en el CSV.
