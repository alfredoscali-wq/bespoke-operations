-- Bespoke Operations — Cuadrillas: link crew supervisor to employees directory
-- Requires: employees + employee_type migrations applied first

ALTER TABLE public.crews
  ADD COLUMN supervisor_employee_id uuid
    REFERENCES public.employees (id)
    ON DELETE SET NULL;

CREATE INDEX crews_supervisor_employee_id_idx
  ON public.crews (supervisor_employee_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.crews.supervisor_employee_id IS
  'Supervisor assigned to this crew (Employee). Not stored in crew_members.';
COMMENT ON COLUMN public.crews.supervisor IS
  'Denormalized supervisor display name for legacy views and task compatibility.';
