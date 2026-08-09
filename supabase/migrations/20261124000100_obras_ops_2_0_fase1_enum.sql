-- OBRAS OPS 2.0 — FASE 1A: enum task_status += 'borrador'
--
-- Separado de funciones/backfill para evitar Postgres 55P04:
-- el nuevo valor de enum no puede usarse hasta COMMIT de esta migración.
--
-- Idempotente: ADD VALUE IF NOT EXISTS.
-- NO modifica funciones, datos, Mobile / Tesorería / Reportes.

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'borrador';

COMMENT ON TYPE public.task_status IS
  'Operational task statuses. borrador = OT de Obra previa a inicio (OPS 2.0).';
