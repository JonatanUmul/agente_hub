-- Identificación de modelos por imagen, en la RÉPLICA DE DESARROLLO. En producción lo crea
-- ecofiltro_bot_vision.sql. Idempotente.

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

ALTER TABLE eco_productos ADD COLUMN IF NOT EXISTS pistas_visuales text;
ALTER TABLE eco_productos ADD COLUMN IF NOT EXISTS fotos_referencia jsonb;

INSERT INTO eco_configuracion (clave, valor, tipo, descripcion, actualizado_por) VALUES
  ('vision_activa', 'false', 'booleano', 'Si es true, el bot identifica modelos en las imágenes del cliente.', 'semilla-dev'),
  ('vision_modelo', 'google/gemini-2.5-pro', 'texto', 'Modelo de OpenRouter para analizar imágenes.', 'semilla-dev')
ON CONFLICT (clave) DO NOTHING;

UPDATE eco_productos
SET pistas_visuales = 'Base ancha tipo campana del mismo color que la tapa.',
    fotos_referencia = '[{"url": "https://ejemplo.invalid/eq1-azul.jpg", "color": "Azul"}]'
WHERE codigo = 'DEV-EQ-1' AND pistas_visuales IS NULL;

COMMIT;
