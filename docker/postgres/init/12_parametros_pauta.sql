-- Parámetros del bot para las imágenes de pauta y la agrupación de mensajes, en la RÉPLICA DE DESARROLLO.
-- Solo para docker/postgres: en producción las claves las crea el administrador. Idempotente.

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

INSERT INTO eco_configuracion (clave, valor, tipo, descripcion, actualizado_por) VALUES
  ('max_fotos_pauta', '1', 'entero', 'Fotos de producto que se envían cuando la pauta no tiene arte', 'semilla-dev'),
  ('segundos_agrupar_mensajes', '5', 'entero', 'Segundos que el bot espera para juntar mensajes seguidos', 'semilla-dev')
ON CONFLICT (clave) DO NOTHING;

COMMIT;
