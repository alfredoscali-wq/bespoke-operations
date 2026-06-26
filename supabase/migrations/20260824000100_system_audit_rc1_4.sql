-- RC1.4 — Historial del Sistema: evolución de system_audit_log

ALTER TABLE public.system_audit_log
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS performed_by_role text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'INFO';

UPDATE public.system_audit_log
SET
  module = CASE
    WHEN entity_type = 'customer' THEN 'clientes'
    WHEN entity_type = 'task' THEN 'tareas'
    ELSE 'sistema'
  END,
  description = COALESCE(
    NULLIF(description, ''),
    'Eliminación definitiva de ' ||
      CASE
        WHEN entity_type = 'customer' THEN 'cliente'
        WHEN entity_type = 'task' THEN 'orden de trabajo'
        ELSE 'registro'
      END
  ),
  severity = 'CRITICAL',
  action = CASE
    WHEN action = 'DELETE_PERMANENT' AND entity_type = 'customer'
      THEN 'CUSTOMER_DELETE_PERMANENT'
    WHEN action = 'DELETE_PERMANENT' AND entity_type = 'task'
      THEN 'TASK_DELETE_PERMANENT'
    ELSE action
  END
WHERE module IS NULL OR description = '' OR action = 'DELETE_PERMANENT';

ALTER TABLE public.system_audit_log
  ALTER COLUMN module SET NOT NULL;

ALTER TABLE public.system_audit_log
  ALTER COLUMN entity_id DROP NOT NULL;

ALTER TABLE public.system_audit_log
  DROP CONSTRAINT IF EXISTS system_audit_log_action_check;

ALTER TABLE public.system_audit_log
  DROP CONSTRAINT IF EXISTS system_audit_log_entity_type_check;

ALTER TABLE public.system_audit_log
  DROP CONSTRAINT IF EXISTS system_audit_log_severity_check;

ALTER TABLE public.system_audit_log
  ADD CONSTRAINT system_audit_log_severity_check
  CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'));

CREATE INDEX IF NOT EXISTS system_audit_log_module_idx
  ON public.system_audit_log (module);

CREATE INDEX IF NOT EXISTS system_audit_log_severity_idx
  ON public.system_audit_log (severity);

CREATE INDEX IF NOT EXISTS system_audit_log_performed_by_user_id_idx
  ON public.system_audit_log (performed_by_user_id);

COMMENT ON COLUMN public.system_audit_log.module IS
  'Módulo funcional: clientes | tareas | obras | rrhh | usuarios | sistema';

COMMENT ON COLUMN public.system_audit_log.description IS
  'Descripción legible del evento para Historial del Sistema.';

COMMENT ON COLUMN public.system_audit_log.performed_by_role IS
  'Rol del usuario al momento del evento. Vacío para actor Sistema.';

COMMENT ON COLUMN public.system_audit_log.severity IS
  'Nivel del evento: INFO | WARNING | CRITICAL';

COMMENT ON COLUMN public.system_audit_log.ip_address IS
  'Dirección IP del request cuando está disponible.';

COMMENT ON COLUMN public.system_audit_log.user_agent IS
  'User-Agent del request cuando está disponible.';
