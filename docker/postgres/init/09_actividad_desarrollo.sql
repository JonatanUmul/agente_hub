-- Actividad FICTICIA del bot en la réplica de desarrollo, para ver el dashboard de reportes con datos.
-- Solo para docker/postgres: nada de esto existe en producción. ~400 conversaciones en los 60 días anteriores a
-- la creación del volumen (así el "periodo anterior" también tiene datos). Sin mensajes ni datos de clientes.
--
-- Idempotente: no hace nada si ya existen conversaciones DEV-CONV-*. Para regenerarla con fechas recientes:
--   docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/09_actividad_desarrollo.sql'
-- (antes, borrar las filas DEV-CONV-* / DEV-WH-* de las tablas operativas).

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM eventos WHERE conversationsthreadid LIKE 'DEV-CONV-%') THEN
    RAISE NOTICE 'La actividad de desarrollo ya existe: no se modifica.';
    RETURN;
  END IF;

  PERFORM setseed(0.42); -- mismos datos en cada volumen nuevo

  -- Una fila por conversación: cuándo empezó (8:00–21:00 de Guatemala), por dónde entró y si pasó a asesor.
  CREATE TEMP TABLE conv_dev ON COMMIT DROP AS
  SELECT 'DEV-CONV-' || n AS id,
         ((current_date - floor(random() * 60)::int)::timestamp + interval '8 hours'
            + random() * interval '13 hours') AT TIME ZONE 'America/Guatemala' AS inicio,
         CASE WHEN r < 0.55 THEN 'comprar_ecofiltro' WHEN r < 0.85 THEN 'atencion_cliente'
              WHEN r < 0.95 THEN 'pauta' ELSE 'ser_distribuidor' END AS entrada,
         random() < 0.6 AS asesor,
         random() AS azar
  FROM (SELECT n, random() AS r FROM generate_series(1, 400) n) t;

  -- Evento del módulo (las pautas siguen a compra). Algunos usan preguntas frecuentes o envían foto o video.
  INSERT INTO eventos (conversationsthreadid, fecha_registro, etapa_descripcion, workflow, status, bandeja,
                       numero_pregunta, fileid)
  SELECT id, inicio + interval '1 minute',
         CASE entrada WHEN 'pauta' THEN 'comprar_ecofiltro' ELSE entrada END,
         CASE entrada WHEN 'pauta' THEN 'comprar_ecofiltro' ELSE entrada END,
         'SENT',
         CASE entrada WHEN 'atencion_cliente' THEN 'SAC' ELSE 'Televentas' END,
         CASE WHEN azar < 0.3 THEN '[1]' WHEN azar < 0.45 THEN '[1,2]' WHEN azar < 0.55 THEN '[2]' ELSE '[]' END,
         CASE WHEN azar > 0.8 THEN 'DEV-FILE-1' WHEN azar > 0.7 THEN 'DEV-FILE-2' END
  FROM conv_dev;

  INSERT INTO eventos (conversationsthreadid, fecha_registro, etapa_descripcion, workflow, status, menu_descripcion_opcion)
  SELECT id, inicio, 'pauta', '14.Pautas', 'RECEIVED', 'DEV-VIGENTE' FROM conv_dev WHERE entrada = 'pauta';

  -- Algunas conversaciones de SAC terminan preguntando por una compra (cambio de módulo).
  INSERT INTO eventos (conversationsthreadid, fecha_registro, etapa_descripcion, workflow, status, bandeja)
  SELECT id, inicio + interval '4 minutes', 'comprar_ecofiltro', 'comprar_ecofiltro', 'SENT', 'Televentas'
  FROM conv_dev WHERE entrada = 'atencion_cliente' AND azar < 0.15;

  -- Paso a asesor: pide asesor, espera entre 1 y 25 minutos y se asigna a un agente de su bandeja.
  INSERT INTO eventos (conversationsthreadid, fecha_registro, workflow, etapa_descripcion, status)
  SELECT id, inicio + interval '5 minutes', 'guardar_espera_agente', 'pendiente_asesor', 'register'
  FROM conv_dev WHERE asesor;
  INSERT INTO eventos (conversationsthreadid, fecha_registro, workflow, etapa_descripcion, status)
  SELECT id, inicio + interval '6 minutes' + azar * interval '24 minutes', 'asignar_agente', 'agente_asignado', 'RECEIVED'
  FROM conv_dev WHERE asesor;
  INSERT INTO chat_asignados (conversationsthreadid, id_hubspot_agentes, createdby, estado_chat, fecha_registro, fecha_cierre)
  SELECT id,
         CASE WHEN entrada = 'atencion_cliente' THEN '9000001' WHEN azar < 0.7 THEN '9000002' ELSE '9000003' END,
         'semilla-dev', 'ABIERTO',
         inicio + interval '6 minutes' + azar * interval '24 minutes',
         inicio + interval '6 minutes' + azar * interval '24 minutes'
  FROM conv_dev WHERE asesor;

  -- Mensajes de la bandeja: 3 a 10 por conversación del bot, más 120 conversaciones sin bot.
  INSERT INTO hubspot_webhook_log (event_id, subscription_type, object_id, received_at, status)
  SELECT 'DEV-WH-' || c.id || '-' || i, 'conversation.newMessage', c.id, c.inicio + i * interval '2 minutes', 'processed'
  FROM conv_dev c, generate_series(0, 2 + floor(c.azar * 8)::int) i;
  INSERT INTO hubspot_webhook_log (event_id, subscription_type, object_id, received_at, status)
  SELECT 'DEV-WH-SIN-BOT-' || n, 'conversation.newMessage', 'DEV-SIN-BOT-' || (n % 120),
         ((current_date - floor(random() * 60)::int)::timestamp + interval '7 hours'
            + random() * interval '15 hours') AT TIME ZONE 'America/Guatemala', 'processed'
  FROM generate_series(1, 500) n;

  -- Inactividad (solo bot): aviso a la hora; la mitad con oferta; algunas vuelven a escribir, otras se cierran.
  INSERT INTO conversation_inactivity_control (control_key, conversationsthreadid, base_event_id, action, sent_at, message)
  SELECT 'DEV-W-' || id, id, 0, 'warning', inicio + interval '1 hour',
         CASE WHEN azar < 0.5 THEN 'Tenemos una promoción para ti' ELSE 'Aviso de inactividad de prueba' END
  FROM conv_dev WHERE NOT asesor AND azar < 0.7;
  INSERT INTO eventos (conversationsthreadid, fecha_registro, workflow, status)
  SELECT id, inicio + interval '90 minutes', 'comprar_ecofiltro', 'RECEIVED'
  FROM conv_dev WHERE NOT asesor AND azar < 0.25;
  INSERT INTO conversation_inactivity_control (control_key, conversationsthreadid, base_event_id, action, sent_at, message)
  SELECT 'DEV-C-' || id, id, 0, 'close', inicio + interval '2 hours', 'Cierre de prueba'
  FROM conv_dev WHERE NOT asesor AND azar >= 0.25 AND azar < 0.7;

  -- Avisos de fuera de horario.
  INSERT INTO agent_hours_notice_control (messageid, conversationsthreadid, notified_at, motivo)
  SELECT 'DEV-FH-' || id, id, inicio,
         CASE extract(isodow FROM inicio AT TIME ZONE 'America/Guatemala')
           WHEN 6 THEN 'fuera_de_horario_sabado' WHEN 7 THEN 'fuera_de_horario_domingo'
           ELSE 'fuera_de_horario_lunes_viernes' END
  FROM conv_dev WHERE asesor AND azar > 0.85;
END $$;
