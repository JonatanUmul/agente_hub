-- Up Migration

-- Usuarios de la app (no son roles de PostgreSQL: todos se conectan como eco_app).
CREATE TABLE gestion.usuarios (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  correo            text NOT NULL UNIQUE CHECK (correo = lower(btrim(correo)) AND correo LIKE '%_@_%'),
  nombre            text NOT NULL CHECK (btrim(nombre) <> ''),
  rol               text NOT NULL CHECK (rol IN ('admin', 'comercial', 'contenido', 'lectura')),
  hash_contrasena   text NOT NULL,
  activo            boolean NOT NULL DEFAULT true,
  intentos_fallidos integer NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta   timestamptz,
  ultimo_acceso     timestamptz,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);

-- Guardamos el hash SHA-256 del token, no el token: quien lea esta tabla no puede suplantar sesiones.
CREATE TABLE gestion.sesiones (
  token_hash text PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES gestion.usuarios (id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  creada_en  timestamptz NOT NULL DEFAULT now(),
  expira_en  timestamptz NOT NULL
);
CREATE INDEX sesiones_usuario_idx ON gestion.sesiones (usuario_id);

-- Down Migration

DROP TABLE gestion.sesiones;
DROP TABLE gestion.usuarios;
