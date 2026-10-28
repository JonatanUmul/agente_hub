# Reportes del bot: indicadores propuestos (fase 5)

Propuesta para aprobar **antes de programar**. Cada indicador sale de columnas reales (ver `docs/base-de-datos.md`,
sección "Tablas operativas del bot"). Todas las consultas son agregadas, parametrizadas (`$1` = desde, `$2` = hasta,
`timestamptz`) y en hora de Guatemala. Ninguna devuelve mensajes, nombres, teléfonos ni correos de clientes.

**Estado**: ✅ se calcula bien · ⚠️ se calcula con una limitación (explicada) · ❌ no se puede con los datos actuales.

> Historia disponible al 27-10-2026: `eventos` desde el 22-10 (5 días), `chat_asignados` y `hubspot_webhook_log`
> desde el 10-10, `conversation_inactivity_control` desde el 02-09. Las comparaciones con el periodo anterior
> tendrán sentido a medida que se acumulen datos.

## 1. Volumen

### 1.1 ✅ Conversaciones atendidas por el bot, por día

```sql
SELECT (fecha_registro AT TIME ZONE 'America/Guatemala')::date AS dia,
       count(DISTINCT conversationsthreadid) AS conversaciones
FROM eventos
WHERE fecha_registro >= $1 AND fecha_registro < $2
GROUP BY 1 ORDER BY 1;
```

### 1.2 ✅ Mensajes de la bandeja por día (todos, con o sin bot)

`hubspot_webhook_log` registra cada mensaje nuevo de la bandeja de HubSpot, en ambos sentidos. Incluye conversaciones
que el bot no atiende: por eso es mayor que 1.1.

```sql
SELECT (received_at AT TIME ZONE 'America/Guatemala')::date AS dia,
       count(*) AS mensajes,
       count(DISTINCT object_id) AS conversaciones
FROM hubspot_webhook_log
WHERE subscription_type = 'conversation.newMessage' AND received_at >= $1 AND received_at < $2
GROUP BY 1 ORDER BY 1;
```

### 1.3 ✅ Horas pico (mapa de calor día de la semana × hora)

```sql
SELECT extract(isodow FROM received_at AT TIME ZONE 'America/Guatemala')::int AS dia_semana,
       extract(hour FROM received_at AT TIME ZONE 'America/Guatemala')::int AS hora,
       count(*) AS mensajes
FROM hubspot_webhook_log
WHERE subscription_type = 'conversation.newMessage' AND received_at >= $1 AND received_at < $2
GROUP BY 1, 2 ORDER BY 1, 2;
```

## 2. Módulos

### 2.1 ✅ Conversaciones por módulo

El módulo se deduce de la etapa registrada (`etapa_descripcion`). Distribuidor todavía no aparece en los datos.

```sql
SELECT CASE etapa_descripcion
         WHEN 'comprar_ecofiltro' THEN 'COMPRA'
         WHEN 'atencion_cliente'  THEN 'SAC'
         WHEN 'ser_distribuidor'  THEN 'DISTRIBUIDOR'
         WHEN 'pauta'             THEN 'PAUTAS'
       END AS modulo,
       count(DISTINCT conversationsthreadid) AS conversaciones
FROM eventos
WHERE etapa_descripcion IN ('comprar_ecofiltro', 'atencion_cliente', 'ser_distribuidor', 'pauta')
  AND fecha_registro >= $1 AND fecha_registro < $2
GROUP BY 1 ORDER BY 2 DESC;
```

### 2.2 ⚠️ Cambios de módulo

Conversaciones que pasaron por más de un módulo. No registra el orden exacto ni el motivo del cambio.

```sql
SELECT count(*) AS conversaciones_con_cambio
FROM (
  SELECT conversationsthreadid
  FROM eventos
  WHERE etapa_descripcion IN ('comprar_ecofiltro', 'atencion_cliente', 'ser_distribuidor')
    AND fecha_registro >= $1 AND fecha_registro < $2
  GROUP BY 1
  HAVING count(DISTINCT etapa_descripcion) > 1
) t;
```

## 3. Asesores

### 3.1 ✅ Conversaciones solo con bot frente a las transferidas a asesor

"Transferida a asesor" = la conversación tiene la etapa `agente_asignado`, que se registra cuando la conversación se
envía a la bandeja de un asesor (confirmado). Con los datos actuales, 154 de 176 (87 %).

```sql
SELECT count(*) FILTER (WHERE NOT con_asesor) AS solo_bot,
       count(*) FILTER (WHERE con_asesor)     AS con_asesor,
       count(*)                               AS total
FROM (
  SELECT conversationsthreadid, bool_or(etapa_descripcion = 'agente_asignado') AS con_asesor
  FROM eventos
  WHERE fecha_registro >= $1 AND fecha_registro < $2
  GROUP BY 1
) t;
```

### 3.2 ✅ Transferencias por bandeja y por agente

`chat_asignados` + `hubspot_agentes` (nombre y bandeja del agente; son datos del personal, no de clientes).

```sql
SELECT lower(COALESCE(h.bandeja, 'sin bandeja')) AS bandeja,
       COALESCE(h.nombre || ' ' || COALESCE(h.apellido, ''), 'Agente ' || c.id_hubspot_agentes) AS agente,
       count(*) AS chats,
       count(DISTINCT c.conversationsthreadid) AS conversaciones
FROM chat_asignados c
LEFT JOIN hubspot_agentes h ON h.id::text = c.id_hubspot_agentes
WHERE c.fecha_registro >= $1 AND c.fecha_registro < $2
GROUP BY 1, 2 ORDER BY 3 DESC;
```

### 3.3 ✅ Avisos de fuera de horario

```sql
SELECT (notified_at AT TIME ZONE 'America/Guatemala')::date AS dia, motivo, count(*) AS avisos
FROM agent_hours_notice_control
WHERE notified_at >= $1 AND notified_at < $2
GROUP BY 1, 2 ORDER BY 1, 2;
```

### 3.4 ⚠️ Tiempo desde que se pide asesor hasta la asignación

Del primer `guardar_espera_agente` al primer `agente_asignado` de la conversación. **Hoy solo hay 1 caso medible**:
el indicador existe, pero será poco confiable hasta que haya más datos.

```sql
WITH espera AS (
  SELECT conversationsthreadid, min(fecha_registro) AS pidio
  FROM eventos WHERE workflow = 'guardar_espera_agente' AND fecha_registro >= $1 AND fecha_registro < $2
  GROUP BY 1),
asignado AS (
  SELECT conversationsthreadid, min(fecha_registro) AS asignado
  FROM eventos WHERE etapa_descripcion = 'agente_asignado' AND fecha_registro >= $1
  GROUP BY 1)
SELECT count(*) AS casos,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM a.asignado - e.pidio) / 60)::numeric, 1) AS mediana_min,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM a.asignado - e.pidio) / 60)::numeric, 1) AS p90_min
FROM espera e JOIN asignado a USING (conversationsthreadid)
WHERE a.asignado >= e.pidio;
```

### 3.5 ❌ Motivo de la transferencia a asesor

No se registra en ninguna tabla.

### 3.6 ❌ Duración de la atención del asesor

`chat_asignados.fecha_cierre` es igual a `fecha_registro` en todas las filas.

## 4. Pautas

### 4.1 ✅ Conversaciones que llegaron por cada pauta y cuántas pasaron a asesor

`menu_descripcion_opcion` guarda el código de la pauta (ej. `PT000001`); se une con `eco_pautas` para el nombre.

```sql
SELECT p.codigo, COALESCE(pa.nombre, p.codigo) AS pauta,
       count(*) AS conversaciones,
       count(*) FILTER (WHERE p.con_asesor) AS pasaron_a_asesor
FROM (
  SELECT e.conversationsthreadid, max(e.menu_descripcion_opcion) AS codigo,
         bool_or(EXISTS (SELECT 1 FROM eventos x
                         WHERE x.conversationsthreadid = e.conversationsthreadid
                           AND x.etapa_descripcion = 'agente_asignado')) AS con_asesor
  FROM eventos e
  WHERE e.etapa_descripcion = 'pauta' AND e.fecha_registro >= $1 AND e.fecha_registro < $2
  GROUP BY 1
) p
LEFT JOIN eco_pautas pa ON pa.codigo = p.codigo
GROUP BY 1, 2 ORDER BY 3 DESC;
```

## 5. Recuperación por inactividad

### 5.1 ✅ Avisos de inactividad, ofertas de recuperación y cierres

```sql
SELECT count(*) FILTER (WHERE action = 'warning') AS avisos,
       count(*) FILTER (WHERE action = 'warning' AND message LIKE '%promoción para ti%') AS ofertas,
       count(*) FILTER (WHERE action = 'close') AS cierres
FROM conversation_inactivity_control
WHERE sent_at >= $1 AND sent_at < $2;
```

### 5.2 ✅ Conversaciones reactivadas después del aviso

Reactivada = el cliente volvió a escribir (evento `RECEIVED`) en las 24 h siguientes al aviso. `register` es un
registro interno del bot y no se cuenta.

```sql
SELECT count(DISTINCT w.conversationsthreadid) AS con_aviso,
       count(DISTINCT w.conversationsthreadid) FILTER (WHERE EXISTS (
         SELECT 1 FROM eventos e
         WHERE e.conversationsthreadid = w.conversationsthreadid
           AND e.status = 'RECEIVED'
           AND e.fecha_registro > w.sent_at AND e.fecha_registro < w.sent_at + interval '24 hours'
       )) AS reactivadas
FROM conversation_inactivity_control w
WHERE w.action = 'warning' AND w.sent_at >= $1 AND w.sent_at < $2;
```

## 6. Contenido

### 6.1 ✅ Preguntas frecuentes más usadas

`numero_pregunta` es un JSON con los números usados; se une con `eco_preguntas_frecuentes`.

```sql
SELECT q.numero, q.pregunta, count(*) AS veces
FROM eventos e
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN e.numero_pregunta ~ '^\[[0-9, ]*\]$' THEN e.numero_pregunta::jsonb ELSE '[]'::jsonb END) AS n(numero)
JOIN eco_preguntas_frecuentes q ON q.numero = n.numero::int
WHERE e.fecha_registro >= $1 AND e.fecha_registro < $2
GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20;
```

### 6.2 ✅ Fotos y videos más enviados

```sql
SELECT m.tipo, m.descripcion, p.nombre AS producto, count(*) AS envios
FROM eventos e
JOIN eco_multimedia m ON m.hubspot_file_id = e.fileid
LEFT JOIN eco_productos p ON p.id = m.producto_id
WHERE e.fecha_registro >= $1 AND e.fecha_registro < $2
GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 20;
```

### 6.3 ⚠️ Productos más consultados

No se registra qué producto consultó el cliente. Solo se puede aproximar por los productos de las fotos y videos
enviados (6.2 agrupado por producto).

```sql
SELECT p.codigo, p.nombre, count(*) AS envios_de_fotos_o_videos
FROM eventos e
JOIN eco_multimedia m ON m.hubspot_file_id = e.fileid
JOIN eco_productos p ON p.id = m.producto_id
WHERE e.fecha_registro >= $1 AND e.fecha_registro < $2
GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20;
```

## 7. Tabla de detalle (sin datos personales)

Una fila por conversación: ID de conversación, fecha, módulos, si pasó a asesor y si llegó por pauta.
Sin teléfono, correo, nombre ni mensajes (el teléfono ni siquiera está en estas tablas como columna propia).

```sql
SELECT conversationsthreadid AS conversacion,
       min(fecha_registro) AS inicio,
       array_agg(DISTINCT etapa_descripcion) FILTER (
         WHERE etapa_descripcion IN ('comprar_ecofiltro', 'atencion_cliente', 'ser_distribuidor')) AS modulos,
       bool_or(etapa_descripcion = 'agente_asignado') AS con_asesor,
       max(menu_descripcion_opcion) FILTER (WHERE etapa_descripcion = 'pauta') AS pauta
FROM eventos
WHERE fecha_registro >= $1 AND fecha_registro < $2
GROUP BY 1 ORDER BY 2 DESC LIMIT 500;
```

## Comparación con el periodo anterior

Cada indicador se calcula dos veces: en el rango elegido y en el rango inmediatamente anterior del mismo largo
(ej. 30 días contra los 30 previos), y se muestra la variación en %.

## Rendimiento

Hoy las tablas son pequeñas y todas las consultas tardan poco. Con el crecimiento, estos índices ayudarían
(**propuestos, no creados**):

```sql
CREATE INDEX CONCURRENTLY eventos_fecha_idx ON eventos (fecha_registro);
CREATE INDEX CONCURRENTLY hubspot_webhook_log_received_idx ON hubspot_webhook_log (received_at);
CREATE INDEX CONCURRENTLY chat_asignados_fecha_idx ON chat_asignados (fecha_registro);
```

## Rol de solo lectura

`docs/sql/rol_eco_reportes.sql` (después de aprobar esta lista) dará a `eco_reportes` `SELECT` **solo sobre las
columnas que usan estas consultas**: por ejemplo, de `eventos` no incluirá `message`, `respuesta_n8n`, `resumen_ia`,
`name` ni `sesionid_cliente`, y de `hubspot_webhook_log` no incluirá `payload`. Así, aunque hubiera un error en la
app, el rol no podría leer datos de clientes.
