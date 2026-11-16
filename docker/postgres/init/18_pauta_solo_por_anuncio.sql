-- Pauta exclusiva del anuncio o abierta a cualquiera, en la RÉPLICA DE DESARROLLO.
-- En producción la columna ya la creó el administrador. Idempotente.

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'eco_pautas' AND column_name = 'solo_por_anuncio') THEN
    ALTER TABLE eco_pautas ADD COLUMN solo_por_anuncio boolean NOT NULL DEFAULT true;
    UPDATE eco_pautas SET solo_por_anuncio = false WHERE aplica_todos;
  END IF;
END $$;

COMMENT ON COLUMN eco_pautas.solo_por_anuncio IS
  'true  = exclusiva del anuncio: el bot no la ve ni la menciona aunque el cliente pregunte por descuentos. '
  'false = abierta: el bot puede ofrecerla a cualquiera, venga o no del anuncio.';

COMMIT;
