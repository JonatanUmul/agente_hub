-- 004 · Destinos nuevos para las reglas del bot: SELECTOR, ORQUESTADOR y VISION.
--
-- YA ESTÁ APLICADO EN PRODUCCIÓN (lo aplicó el equipo del bot el 27-10-2026, junto con los cambios de n8n).
-- Este script lo deja registrado y lo replica en desarrollo. Es idempotente: correrlo de nuevo no cambia nada.
--
-- Qué agente lee cada destino (las reglas de su destino + las de TODOS):
--   TODOS        todos los agentes
--   ENRUTADOR    analizador de ramas (COMPRA y SAC)
--   SELECTOR     identificador de modelo, selector de video, FAQ de SAC
--   REDACTOR     redactor final, agente de tienda, FAQ de COMPRA
--   ORQUESTADOR  orquestador central (solo lee reglas GLOBAL)
--   VISION       análisis de fotos enviadas por el cliente (en preparación)

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

ALTER TABLE eco_reglas_bot DROP CONSTRAINT IF EXISTS eco_reglas_bot_destino_check;
ALTER TABLE eco_reglas_bot ADD CONSTRAINT eco_reglas_bot_destino_check
  CHECK (destino = ANY (ARRAY['TODOS', 'ENRUTADOR', 'REDACTOR', 'SELECTOR', 'ORQUESTADOR', 'VISION']));

COMMIT;
