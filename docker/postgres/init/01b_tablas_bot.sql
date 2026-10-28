-- Tablas operativas del bot que la app lee (sin escribir). Réplica de la ESTRUCTURA de producción (oct. 2026).
-- La app solo necesita hubspot_agentes (para los horarios); el resto de tablas del bot no se replican.

SET ROLE eco_admin;

CREATE TABLE hubspot_agentes (
  id                         bigint PRIMARY KEY,
  created_at                 timestamptz,
  updated_at                 timestamptz,
  archived                   boolean NOT NULL DEFAULT false,
  equipo_principal_id        bigint,
  equipo_principal_nombre    varchar(255),
  actor_id                   varchar(50),
  fecha_registro             timestamptz NOT NULL DEFAULT now(),
  telefono                   varchar(20),
  limite_chats               integer NOT NULL DEFAULT 1,
  bandeja                    varchar(100),
  estado_agente              varchar(25),
  hora_inicio                time,
  hora_fin                   time,
  canal                      varchar(50),
  email                      varchar(255) NOT NULL UNIQUE,
  tipo                       varchar(50),
  nombre                     varchar(100),
  apellido                   varchar(100),
  user_id                    bigint,
  user_id_including_inactive bigint
);

-- En producción n8n sincroniza esta tabla.
GRANT SELECT, INSERT, UPDATE, DELETE ON hubspot_agentes TO eco_n8n;

RESET ROLE;

-- Tablas operativas que lee el módulo de reportes (estructura de producción, 27-10-2026). Sin datos reales:
-- las pruebas de integración insertan sus propios datos inventados.
SET ROLE eco_admin;

CREATE TABLE eventos (
  id                      serial PRIMARY KEY,
  id_menu_opcion          varchar(250),
  menu_descripcion_opcion varchar(250),
  sessionid               varchar(250),
  sesionid_cliente        text,
  bandeja                 varchar(250),
  imagen                  varchar(250),
  video                   varchar(250),
  fileid                  varchar(250),
  numero_pregunta         varchar(250),
  name                    varchar(250),
  conversationsthreadid   varchar(250),
  messageid               varchar(250),
  status                  varchar(250),
  recuperacion            varchar(250),
  resumen_ia              text,
  respuesta_n8n           text,
  createdby               varchar(250),
  fecha_registro          timestamptz,
  fecha_cierre            timestamptz,
  executionid             varchar(150),
  workflow                varchar(100),
  channelaccountid        varchar(250),
  channelid               varchar(250),
  message                 text,
  etapa_conversacion      varchar(250),
  etapa_descripcion       varchar(250),
  id_menu                 varchar(250),
  menu_descripcion        varchar(250)
);
CREATE INDEX eventos_messageid_idx ON eventos (messageid);
CREATE INDEX eventos_thread_idx ON eventos (conversationsthreadid, fecha_registro);

CREATE TABLE hubspot_webhook_log (
  id                  bigserial PRIMARY KEY,
  payload             jsonb,
  portal_id           text,
  app_id              text,
  message_type        text,
  change_flag         text,
  subscription_type   text,
  processing_attempts integer,
  processed_at        timestamptz,
  last_error          text,
  locked_at           timestamptz,
  event_id            text UNIQUE,
  subscription_id     text,
  object_id           text,
  message_id          text,
  attempt_number      integer,
  occurred_at         bigint,
  received_at         timestamptz,
  status              text
);
CREATE INDEX hubspot_webhook_log_object_time_idx ON hubspot_webhook_log (object_id, occurred_at);

CREATE TABLE chat_asignados (
  id                    serial PRIMARY KEY,
  channelid             varchar(100),
  status                varchar(100),
  sesionid_cliente      varchar(250),
  id_hubspot_agentes    varchar(25),
  conversationsthreadid varchar(75) NOT NULL,
  createdby             varchar(75) NOT NULL,
  estado_chat           varchar(20),
  fecha_registro        timestamptz NOT NULL,
  fecha_cierre          timestamptz,
  sessionid             varchar(250),
  channelaccountid      varchar(100)
);
CREATE INDEX chat_asignados_thread_idx ON chat_asignados (conversationsthreadid);

CREATE TABLE conversation_inactivity_control (
  control_key           text PRIMARY KEY,
  conversationsthreadid text NOT NULL,
  base_event_id         bigint NOT NULL,
  action                text NOT NULL,
  sent_at               timestamptz,
  message               text
);

CREATE TABLE agent_hours_notice_control (
  messageid             text PRIMARY KEY,
  conversationsthreadid text,
  notified_at           timestamptz,
  motivo                text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON eventos, hubspot_webhook_log, chat_asignados,
  conversation_inactivity_control, agent_hours_notice_control TO eco_n8n;

RESET ROLE;
