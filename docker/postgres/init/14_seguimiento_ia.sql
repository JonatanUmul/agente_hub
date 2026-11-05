-- Seguimiento con IA por inactividad en la RÉPLICA DE DESARROLLO.
-- Solo para docker/postgres: en producción lo aplicó el administrador (ecofiltro_bot_seguimiento_ia.sql). Idempotente.

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

INSERT INTO eco_configuracion (clave, valor, tipo, descripcion, actualizado_por)
VALUES ('seguimiento_ia_activo', 'false', 'booleano', 'Seguimiento con IA cuando el cliente deja de responder', 'semilla-dev')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO eco_mensajes_tipos (clave, categoria, titulo, descripcion, comodines, varias, orden) VALUES
  ('seguimiento_ia_modelos',   'Seguimiento', 'Varios modelos',  'Se le enviaron varios productos', '{}', true, 10),
  ('seguimiento_ia_producto',  'Seguimiento', 'Producto',        'Preguntó por un producto', ARRAY['producto'], true, 20),
  ('seguimiento_ia_promocion', 'Seguimiento', 'Promoción',       'El producto tiene descuento o pauta vigente', ARRAY['producto', 'promocion'], true, 30),
  ('seguimiento_ia_sac',       'Seguimiento', 'Atención al cliente', 'Consulta de atención al cliente', '{}', true, 40),
  ('seguimiento_ia_general',   'Seguimiento', 'General',         'Algo pendiente que no es de los anteriores', '{}', true, 50)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO eco_mensajes (clave, texto, orden, actualizado_por) VALUES
  ('seguimiento_ia_producto', '¿Te quedó alguna duda sobre el {producto}? 😊', 10, 'semilla-dev'),
  ('seguimiento_ia_promocion', 'El {producto} tiene {promocion} 🎉 ¿Te ayudo con tu pedido?', 10, 'semilla-dev')
ON CONFLICT (clave, texto) DO NOTHING;

COMMIT;

-- Decisiones ficticias de la IA sobre conversaciones de 09_actividad_desarrollo.sql (sin datos de clientes).
INSERT INTO conversation_inactivity_control (control_key, conversationsthreadid, base_event_id, action, sent_at, message)
SELECT 'DEV-IA-' || n, 'DEV-CONV-' || n, 0,
       CASE WHEN n % 3 = 0 THEN 'cierre_ia' ELSE 'seguimiento_ia' END,
       now() - (n % 20) * interval '1 day' - interval '2 hours',
       CASE WHEN n % 3 = 0 THEN 'cerrar: se despidió' ELSE '¿Te quedó alguna duda sobre el Ecofiltro Colors? 😊' END
FROM generate_series(1, 40) n
ON CONFLICT (control_key) DO NOTHING;
