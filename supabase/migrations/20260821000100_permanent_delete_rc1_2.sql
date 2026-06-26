-- RC1.2 — Eliminación definitiva (Administrador) + auditoría del sistema

CREATE TABLE IF NOT EXISTS public.system_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_label text,
  performed_by_user_id uuid,
  performed_by_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_audit_log_action_check
    CHECK (action IN ('DELETE_PERMANENT')),
  CONSTRAINT system_audit_log_entity_type_check
    CHECK (entity_type IN ('customer', 'task'))
);

CREATE INDEX IF NOT EXISTS system_audit_log_created_at_idx
  ON public.system_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS system_audit_log_action_idx
  ON public.system_audit_log (action);

CREATE INDEX IF NOT EXISTS system_audit_log_entity_idx
  ON public.system_audit_log (entity_type, entity_id);

COMMENT ON TABLE public.system_audit_log IS
  'RC1.2 — Auditoría de acciones administrativas del sistema. Persiste eventos aunque la entidad sea eliminada.';

COMMENT ON COLUMN public.system_audit_log.action IS
  'Tipo de acción auditada. RC1.2: DELETE_PERMANENT.';

COMMENT ON COLUMN public.system_audit_log.entity_type IS
  'Tipo de entidad afectada: customer | task.';

COMMENT ON COLUMN public.system_audit_log.entity_id IS
  'UUID de la entidad eliminada (conservado como registro histórico).';

COMMENT ON COLUMN public.system_audit_log.entity_label IS
  'Etiqueta legible al momento de la eliminación (nombre, código OT, etc.).';

ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;

-- Sin políticas para roles autenticados: solo service role (API admin) escribe/lee.
