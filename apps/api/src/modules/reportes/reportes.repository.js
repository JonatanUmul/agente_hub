// Consultas de reportes (docs/reportes-indicadores.md). Se ejecutan con el pool de SOLO LECTURA (rol eco_reportes,
// permisos por columna): no pueden leer mensajes ni datos de clientes aunque se intentara.
//
// Parámetros comunes a todas:
//   $1 desde (date)  $2 hasta (date)  — hora de Guatemala, rango [desde 00:00, hasta + 1 día 00:00)
//   $3 etapa del módulo (text | null)  $4 bandeja en minúsculas (text | null)  $5 id de agente (text | null)
//
// `conv` = conversaciones del bot con actividad en el rango que cumplen los filtros. Sin filtros son todas.
// Los indicadores que vienen de otras tablas (mensajes de la bandeja, avisos) se limitan a `conv` solo cuando hay
// algún filtro activo (`filtrado.hay`); sin filtros cuentan toda la bandeja.
const BASE = `
WITH rango AS (
  SELECT ($1::date)::timestamp AT TIME ZONE 'America/Guatemala'       AS ini,
         ($2::date + 1)::timestamp AT TIME ZONE 'America/Guatemala'   AS fin
),
conv AS (
  SELECT e.conversationsthreadid AS id
  FROM eventos e, rango r
  WHERE e.fecha_registro >= r.ini AND e.fecha_registro < r.fin AND e.conversationsthreadid IS NOT NULL
  GROUP BY 1
  HAVING ($3::text IS NULL OR bool_or(e.etapa_descripcion = $3))
     AND ($4::text IS NULL
          OR bool_or(lower(e.bandeja) = $4)
          OR EXISTS (SELECT 1 FROM chat_asignados c JOIN hubspot_agentes h ON h.id::text = c.id_hubspot_agentes
                     WHERE c.conversationsthreadid = e.conversationsthreadid AND lower(h.bandeja) = $4))
     AND ($5::text IS NULL
          OR EXISTS (SELECT 1 FROM chat_asignados c
                     WHERE c.conversationsthreadid = e.conversationsthreadid AND c.id_hubspot_agentes = $5))
),
filtrado AS (SELECT ($3::text IS NOT NULL OR $4::text IS NOT NULL OR $5::text IS NOT NULL) AS hay),
-- Eventos del rango que pertenecen a las conversaciones filtradas. Columnas explícitas: el rol de reportes
-- no tiene permiso sobre las demás (mensajes y datos del cliente), así que un SELECT * fallaría.
ev AS (
  SELECT e.conversationsthreadid, e.fecha_registro, e.workflow, e.etapa_descripcion, e.status, e.bandeja,
         e.menu_descripcion_opcion, e.fileid, e.numero_pregunta
  FROM eventos e, rango r
  WHERE e.fecha_registro >= r.ini AND e.fecha_registro < r.fin
    AND e.conversationsthreadid IN (SELECT id FROM conv)
)`;

const parametros = ({ desde, hasta, etapa, bandeja, agente }) => [
  desde,
  hasta,
  etapa ?? null,
  bandeja ?? null,
  agente ?? null,
];

async function consultar(db, filtros, sql) {
  const { rows } = await db.query(`${BASE}\n${sql}`, parametros(filtros));
  return rows;
}

// Tarjetas: todo lo que se compara contra el periodo anterior, en una sola fila.
export async function tarjetas(db, filtros) {
  const [fila] = await consultar(
    db,
    filtros,
    `SELECT
       (SELECT count(*)::int FROM conv) AS conversaciones,
       (SELECT count(DISTINCT conversationsthreadid)::int FROM ev WHERE etapa_descripcion = 'agente_asignado') AS transferidas,
       (SELECT count(*)::int FROM (
          SELECT conversationsthreadid FROM ev
          WHERE etapa_descripcion IN ('comprar_ecofiltro', 'atencion_cliente', 'ser_distribuidor')
          GROUP BY 1 HAVING count(DISTINCT etapa_descripcion) > 1) t) AS cambios_modulo,
       (SELECT count(*)::int FROM hubspot_webhook_log w, rango r, filtrado f
         WHERE w.subscription_type = 'conversation.newMessage' AND w.received_at >= r.ini AND w.received_at < r.fin
           AND (NOT f.hay OR w.object_id IN (SELECT id FROM conv))) AS mensajes_bandeja,
       (SELECT count(*)::int FROM agent_hours_notice_control a, rango r, filtrado f
         WHERE a.notified_at >= r.ini AND a.notified_at < r.fin
           AND (NOT f.hay OR a.conversationsthreadid IN (SELECT id FROM conv))) AS avisos_fuera_horario,
       (SELECT count(*)::int FROM conversation_inactivity_control i, rango r, filtrado f
         WHERE i.action = 'warning' AND i.sent_at >= r.ini AND i.sent_at < r.fin
           AND (NOT f.hay OR i.conversationsthreadid IN (SELECT id FROM conv))) AS avisos_inactividad,
       (SELECT count(*)::int FROM conversation_inactivity_control i, rango r, filtrado f
         WHERE i.action = 'warning' AND i.message LIKE '%promoción para ti%'
           AND i.sent_at >= r.ini AND i.sent_at < r.fin
           AND (NOT f.hay OR i.conversationsthreadid IN (SELECT id FROM conv))) AS ofertas_recuperacion,
       (SELECT count(*)::int FROM conversation_inactivity_control i, rango r, filtrado f
         WHERE i.action = 'close' AND i.sent_at >= r.ini AND i.sent_at < r.fin
           AND (NOT f.hay OR i.conversationsthreadid IN (SELECT id FROM conv))) AS cierres_inactividad`,
  );
  return fila;
}

// Conversaciones con aviso de inactividad y cuántas se reactivaron: el cliente escribió (RECEIVED) en las 24 h
// siguientes. `register` es un registro interno del bot y no cuenta.
export async function reactivacion(db, filtros) {
  const [fila] = await consultar(
    db,
    filtros,
    `SELECT count(DISTINCT w.conversationsthreadid)::int AS con_aviso,
            count(DISTINCT w.conversationsthreadid) FILTER (WHERE EXISTS (
              SELECT 1 FROM eventos e
              WHERE e.conversationsthreadid = w.conversationsthreadid AND e.status = 'RECEIVED'
                AND e.fecha_registro > w.sent_at AND e.fecha_registro < w.sent_at + interval '24 hours'))::int AS reactivadas
     FROM conversation_inactivity_control w, rango r, filtrado f
     WHERE w.action = 'warning' AND w.sent_at >= r.ini AND w.sent_at < r.fin
       AND (NOT f.hay OR w.conversationsthreadid IN (SELECT id FROM conv))`,
  );
  return fila;
}

// Tiempo desde que se pide asesor (guardar_espera_agente) hasta que pasa a su bandeja (agente_asignado).
export async function tiempoAsignacion(db, filtros) {
  const [fila] = await consultar(
    db,
    filtros,
    `, espera AS (SELECT conversationsthreadid, min(fecha_registro) AS pidio FROM ev
                  WHERE workflow = 'guardar_espera_agente' GROUP BY 1),
       asignado AS (SELECT conversationsthreadid, min(fecha_registro) AS asignado FROM ev
                    WHERE etapa_descripcion = 'agente_asignado' GROUP BY 1),
       minutos AS (SELECT extract(epoch FROM a.asignado - e.pidio) / 60 AS m
                   FROM espera e JOIN asignado a USING (conversationsthreadid) WHERE a.asignado >= e.pidio)
     SELECT count(*)::int AS casos,
            round(percentile_cont(0.5) WITHIN GROUP (ORDER BY m)::numeric, 1)::float AS mediana_min,
            round(percentile_cont(0.9) WITHIN GROUP (ORDER BY m)::numeric, 1)::float AS p90_min
     FROM minutos`,
  );
  return fila;
}

// Conversaciones del bot y mensajes de la bandeja por día (todos los días del rango, también los vacíos).
export async function porDia(db, filtros) {
  return consultar(
    db,
    filtros,
    `, dias AS (SELECT generate_series($1::date, $2::date, interval '1 day')::date AS dia),
       c AS (SELECT (fecha_registro AT TIME ZONE 'America/Guatemala')::date AS dia,
                    count(DISTINCT conversationsthreadid)::int AS conversaciones,
                    count(DISTINCT conversationsthreadid) FILTER (WHERE etapa_descripcion = 'agente_asignado')::int AS transferidas
             FROM ev GROUP BY 1),
       m AS (SELECT (w.received_at AT TIME ZONE 'America/Guatemala')::date AS dia, count(*)::int AS mensajes
             FROM hubspot_webhook_log w, rango r, filtrado f
             WHERE w.subscription_type = 'conversation.newMessage' AND w.received_at >= r.ini AND w.received_at < r.fin
               AND (NOT f.hay OR w.object_id IN (SELECT id FROM conv))
             GROUP BY 1)
     SELECT d.dia::text AS dia, COALESCE(c.conversaciones, 0) AS conversaciones,
            COALESCE(c.transferidas, 0) AS transferidas, COALESCE(m.mensajes, 0) AS mensajes
     FROM dias d LEFT JOIN c USING (dia) LEFT JOIN m USING (dia)
     ORDER BY d.dia`,
  );
}

// Mapa de calor: mensajes de la bandeja por día de la semana (ISO 1 = lunes) y hora.
export async function horasPico(db, filtros) {
  return consultar(
    db,
    filtros,
    `SELECT extract(isodow FROM w.received_at AT TIME ZONE 'America/Guatemala')::int AS dia_semana,
            extract(hour FROM w.received_at AT TIME ZONE 'America/Guatemala')::int AS hora,
            count(*)::int AS mensajes
     FROM hubspot_webhook_log w, rango r, filtrado f
     WHERE w.subscription_type = 'conversation.newMessage' AND w.received_at >= r.ini AND w.received_at < r.fin
       AND (NOT f.hay OR w.object_id IN (SELECT id FROM conv))
     GROUP BY 1, 2`,
  );
}

export async function porModulo(db, filtros) {
  return consultar(
    db,
    filtros,
    `SELECT CASE etapa_descripcion
              WHEN 'comprar_ecofiltro' THEN 'COMPRA' WHEN 'atencion_cliente' THEN 'SAC'
              WHEN 'ser_distribuidor' THEN 'DISTRIBUIDOR' WHEN 'pauta' THEN 'PAUTAS' END AS modulo,
            count(DISTINCT conversationsthreadid)::int AS conversaciones
     FROM ev
     WHERE etapa_descripcion IN ('comprar_ecofiltro', 'atencion_cliente', 'ser_distribuidor', 'pauta')
     GROUP BY 1 ORDER BY 2 DESC`,
  );
}

// Transferencias por agente (nombre del personal, no del cliente) y su bandeja.
export async function porAgente(db, filtros) {
  return consultar(
    db,
    filtros,
    `SELECT c.id_hubspot_agentes AS agente_id,
            COALESCE(NULLIF(btrim(concat_ws(' ', h.nombre, h.apellido)), ''), 'Agente ' || c.id_hubspot_agentes) AS agente,
            lower(COALESCE(h.bandeja, 'sin bandeja')) AS bandeja,
            count(*)::int AS chats,
            count(DISTINCT c.conversationsthreadid)::int AS conversaciones
     FROM chat_asignados c
     LEFT JOIN hubspot_agentes h ON h.id::text = c.id_hubspot_agentes, rango r, filtrado f
     WHERE c.fecha_registro >= r.ini AND c.fecha_registro < r.fin
       AND (NOT f.hay OR c.conversationsthreadid IN (SELECT id FROM conv))
       AND ($4::text IS NULL OR lower(h.bandeja) = $4)
       AND ($5::text IS NULL OR c.id_hubspot_agentes = $5)
     GROUP BY 1, 2, 3 ORDER BY 4 DESC`,
  );
}

export async function fueraDeHorario(db, filtros) {
  return consultar(
    db,
    filtros,
    `SELECT a.motivo, count(*)::int AS avisos
     FROM agent_hours_notice_control a, rango r, filtrado f
     WHERE a.notified_at >= r.ini AND a.notified_at < r.fin
       AND (NOT f.hay OR a.conversationsthreadid IN (SELECT id FROM conv))
     GROUP BY 1 ORDER BY 2 DESC`,
  );
}

// Pautas: el código va en menu_descripcion_opcion de los eventos con etapa 'pauta'.
export async function porPauta(db, filtros) {
  return consultar(
    db,
    filtros,
    `, llegadas AS (
         SELECT conversationsthreadid, max(menu_descripcion_opcion) AS codigo FROM ev
         WHERE etapa_descripcion = 'pauta' GROUP BY 1),
       transferidas AS (SELECT DISTINCT conversationsthreadid FROM ev WHERE etapa_descripcion = 'agente_asignado')
     SELECT l.codigo, COALESCE(p.nombre, l.codigo) AS pauta,
            count(*)::int AS conversaciones,
            count(t.conversationsthreadid)::int AS transferidas
     FROM llegadas l
     LEFT JOIN transferidas t USING (conversationsthreadid)
     LEFT JOIN eco_pautas p ON p.codigo = l.codigo
     GROUP BY 1, 2 ORDER BY 3 DESC`,
  );
}

// numero_pregunta guarda un JSON como '[12,55]'; se ignora cualquier otro formato.
export async function preguntasMasUsadas(db, filtros) {
  return consultar(
    db,
    filtros,
    `SELECT q.numero, q.pregunta, count(*)::int AS veces
     FROM ev e
     CROSS JOIN LATERAL jsonb_array_elements_text(
       CASE WHEN e.numero_pregunta ~ '^\\[[0-9, ]*\\]$' THEN e.numero_pregunta::jsonb ELSE '[]'::jsonb END) AS n(numero)
     JOIN eco_preguntas_frecuentes q ON q.numero = n.numero::int
     GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`,
  );
}

export async function multimediaMasEnviada(db, filtros) {
  return consultar(
    db,
    filtros,
    `SELECT m.tipo, m.descripcion, p.codigo AS producto_codigo, p.nombre AS producto, count(*)::int AS envios
     FROM ev e
     JOIN eco_multimedia m ON m.hubspot_file_id = e.fileid
     LEFT JOIN eco_productos p ON p.id = m.producto_id
     GROUP BY 1, 2, 3, 4 ORDER BY 5 DESC LIMIT 20`,
  );
}

// Una fila por conversación, sin datos del cliente.
export async function detalle(db, filtros) {
  return consultar(
    db,
    filtros,
    `SELECT conversationsthreadid AS conversacion,
            min(fecha_registro) AS inicio,
            COALESCE(array_agg(DISTINCT CASE etapa_descripcion
                       WHEN 'comprar_ecofiltro' THEN 'COMPRA' WHEN 'atencion_cliente' THEN 'SAC'
                       WHEN 'ser_distribuidor' THEN 'DISTRIBUIDOR' END)
                     FILTER (WHERE etapa_descripcion IN ('comprar_ecofiltro', 'atencion_cliente', 'ser_distribuidor')),
                     '{}') AS modulos,
            bool_or(etapa_descripcion = 'agente_asignado') AS transferida,
            max(menu_descripcion_opcion) FILTER (WHERE etapa_descripcion = 'pauta') AS pauta
     FROM ev
     GROUP BY 1 ORDER BY 2 DESC LIMIT 500`,
  );
}
