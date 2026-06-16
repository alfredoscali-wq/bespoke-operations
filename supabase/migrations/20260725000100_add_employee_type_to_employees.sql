-- Bespoke Operations — RRHH: structured employee type for roles and crew supervisors
-- Requires: employees migration applied first

CREATE TYPE public.employee_type AS ENUM (
  'operario',
  'supervisor',
  'administrativo',
  'gerente',
  'otro'
);

ALTER TABLE public.employees
  ADD COLUMN employee_type public.employee_type NOT NULL DEFAULT 'otro';

COMMENT ON COLUMN public.employees.employee_type IS
  'Structured employee type (Operario, Supervisor, etc.). Legacy rows default to otro.';
