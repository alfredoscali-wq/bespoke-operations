-- Tesorería 2.0 — Retiros (withdrawal)
-- Third movement type: reduces cash balance without being an operational expense.

ALTER TYPE public.treasury_movement_type ADD VALUE IF NOT EXISTS 'withdrawal';
