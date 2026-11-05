-- Pauta para todos los modelos (formas de pago, beneficios generales como Visa Cuotas), en la RÉPLICA DE
-- DESARROLLO. En producción la columna la crea ecofiltro_bot_pauta_todos_modelos.sql. Idempotente.

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

ALTER TABLE eco_pautas ADD COLUMN IF NOT EXISTS aplica_todos boolean NOT NULL DEFAULT false;

INSERT INTO eco_pautas (codigo, nombre, mensaje_cliente, descuento_pct, aplica_todos, actualizado_por)
VALUES ('VISA_CUOTAS', 'Visa Cuotas', 'Paga en cuotas con tu tarjeta Visa.', NULL, true, 'semilla-dev')
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
