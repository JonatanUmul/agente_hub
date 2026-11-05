-- Up Migration

-- Una fila por sesión iniciada. Sobrevive al borrado de gestion.sesiones para saber cuándo entró y salió cada uno.
CREATE TABLE gestion.historial_sesiones (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id       integer NOT NULL REFERENCES gestion.usuarios (id) ON DELETE CASCADE,
  inicio           timestamptz NOT NULL DEFAULT now(),
  ultima_actividad timestamptz NOT NULL DEFAULT now(),
  fin              timestamptz,
  motivo_fin       text CHECK (motivo_fin IN ('salida', 'expirada', 'cerrada_por_admin', 'contrasena', 'desactivado')),
  ip               text,
  navegador        text
);
CREATE INDEX historial_sesiones_inicio_idx ON gestion.historial_sesiones (inicio);
CREATE INDEX historial_sesiones_usuario_idx ON gestion.historial_sesiones (usuario_id, inicio);

ALTER TABLE gestion.sesiones
  ADD COLUMN historial_id bigint REFERENCES gestion.historial_sesiones (id) ON DELETE SET NULL;

-- Intentos fallidos, bloqueos y cambios hechos por un admin. `correo` se guarda aunque no exista el usuario.
CREATE TABLE gestion.eventos_usuarios (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  integer REFERENCES gestion.usuarios (id) ON DELETE CASCADE,
  correo      text NOT NULL,
  evento      text NOT NULL CHECK (evento IN (
                'acceso_fallido', 'bloqueo', 'creado', 'editado', 'desactivado', 'activado',
                'contrasena_restablecida', 'contrasena_cambiada', 'sesiones_cerradas')),
  detalle     jsonb,
  hecho_por   text,
  ip          text,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eventos_usuarios_creado_idx ON gestion.eventos_usuarios (creado_en);

-- Down Migration

DROP TABLE gestion.eventos_usuarios;
ALTER TABLE gestion.sesiones DROP COLUMN historial_id;
DROP TABLE gestion.historial_sesiones;
