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
