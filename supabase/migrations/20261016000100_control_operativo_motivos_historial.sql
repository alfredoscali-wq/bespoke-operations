-- SPRINT CONTROL OPERATIVO 1.0
-- Motivos configurables (cancelación / reprogramación) + historial operativo durable.
--
-- Multi-tenant: reutiliza public.auth_user_company_id() (empleados.app_user_id → company_id).
-- Autorización de edición: mismo patrón que incident_types / checklist / employee_types
--   (auth_user_system_role + auth_user_has_allowed_module('settings') + demo read-only).

CREATE TABLE IF NOT EXISTS public.operational_motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  kind text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_motivos_kind_valid
    CHECK (kind IN ('cancelacion', 'reprogramacion')),
  CONSTRAINT operational_motivos_code_not_blank
    CHECK (char_length(trim(code)) > 0),
  CONSTRAINT operational_motivos_label_not_blank
    CHECK (char_length(trim(label)) > 0),
  CONSTRAINT operational_motivos_sort_order_positive
    CHECK (sort_order > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS operational_motivos_company_kind_code_unique
  ON public.operational_motivos (company_id, kind, code);

CREATE INDEX IF NOT EXISTS operational_motivos_company_kind_active_idx
  ON public.operational_motivos (company_id, kind, is_active, sort_order);

COMMENT ON TABLE public.operational_motivos IS
  'Tenant-configurable cancellation and reschedule motives for OT control operativo.';

CREATE OR REPLACE FUNCTION public.set_operational_motivos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS operational_motivos_set_updated_at ON public.operational_motivos;
CREATE TRIGGER operational_motivos_set_updated_at
  BEFORE UPDATE ON public.operational_motivos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_operational_motivos_updated_at();

CREATE OR REPLACE FUNCTION public.auth_can_manage_operational_motivos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.auth_user_system_role() = 'supervisor'
    OR public.auth_user_has_allowed_module('settings')
  )
  AND NOT public.auth_is_demo_platform_read_only();
$$;

COMMENT ON FUNCTION public.auth_can_manage_operational_motivos() IS
  'True when authenticated user may edit operational motivos (Administrador, Técnica/supervisor, or settings module).';

ALTER TABLE public.operational_motivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_motivos_select_policy ON public.operational_motivos;
CREATE POLICY operational_motivos_select_policy
  ON public.operational_motivos
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS operational_motivos_insert_policy ON public.operational_motivos;
CREATE POLICY operational_motivos_insert_policy
  ON public.operational_motivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_operational_motivos()
  );

DROP POLICY IF EXISTS operational_motivos_update_policy ON public.operational_motivos;
CREATE POLICY operational_motivos_update_policy
  ON public.operational_motivos
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_operational_motivos()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_operational_motivos()
  );

DROP POLICY IF EXISTS operational_motivos_delete_policy ON public.operational_motivos;
CREATE POLICY operational_motivos_delete_policy
  ON public.operational_motivos
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_operational_motivos()
  );

CREATE OR REPLACE FUNCTION public.seed_default_operational_motivos(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.operational_motivos (company_id, kind, code, label, sort_order)
  VALUES
    (p_company_id, 'cancelacion', 'cliente-solicito', 'Cliente solicitó cancelación', 1),
    (p_company_id, 'cancelacion', 'cliente-ausente', 'Cliente ausente / no contactable', 2),
    (p_company_id, 'cancelacion', 'sin-acceso', 'Sin acceso al domicilio', 3),
    (p_company_id, 'cancelacion', 'material-no-disponible', 'Material no disponible', 4),
    (p_company_id, 'cancelacion', 'condiciones-tecnicas', 'Condiciones técnicas impeditivas', 5),
    (p_company_id, 'cancelacion', 'duplicada', 'Orden duplicada / error de carga', 6),
    (p_company_id, 'cancelacion', 'otro', 'Otro', 7),
    (p_company_id, 'reprogramacion', 'cliente-solicito', 'Cliente solicitó reprogramación', 1),
    (p_company_id, 'reprogramacion', 'cuadrilla-no-disponible', 'Cuadrilla no disponible', 2),
    (p_company_id, 'reprogramacion', 'clima', 'Condiciones climáticas', 3),
    (p_company_id, 'reprogramacion', 'material-no-disponible', 'Material no disponible', 4),
    (p_company_id, 'reprogramacion', 'conflicto-agenda', 'Conflicto de agenda', 5),
    (p_company_id, 'reprogramacion', 'error-planificacion', 'Error de planificación', 6),
    (p_company_id, 'reprogramacion', 'otro', 'Otro', 7)
  ON CONFLICT (company_id, kind, code) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_default_operational_motivos(uuid) IS
  'Idempotently seeds default cancelación/reprogramación motives for a company.';

-- Seed defaults for every active company (idempotent)
DO $$
DECLARE
  company record;
BEGIN
  FOR company IN
    SELECT id
    FROM public.companies
    WHERE deleted_at IS NULL
  LOOP
    PERFORM public.seed_default_operational_motivos(company.id);
  END LOOP;
END $$;

-- Durable OT operational timeline (append-only)
CREATE TABLE IF NOT EXISTS public.task_operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  observations text NOT NULL DEFAULT '',
  actor_user_id uuid NULL,
  actor_employee_id uuid NULL,
  actor_display_name text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_operational_events_type_not_blank
    CHECK (char_length(trim(event_type)) > 0),
  CONSTRAINT task_operational_events_title_not_blank
    CHECK (char_length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS task_operational_events_task_occurred_idx
  ON public.task_operational_events (task_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS task_operational_events_company_type_idx
  ON public.task_operational_events (company_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS task_operational_events_payload_gin
  ON public.task_operational_events USING gin (payload);

COMMENT ON TABLE public.task_operational_events IS
  'Append-only operational timeline for work orders. Never update/delete for history integrity.';

COMMENT ON COLUMN public.task_operational_events.payload IS
  'Structured data for Reportes 2.0 (motivo, previous/next schedule, crew, supervisor, related incident, etc.).';

ALTER TABLE public.task_operational_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_operational_events_select_policy ON public.task_operational_events;
CREATE POLICY task_operational_events_select_policy
  ON public.task_operational_events
  FOR SELECT
  TO authenticated
  USING (company_id = public.auth_user_company_id());

DROP POLICY IF EXISTS task_operational_events_insert_policy ON public.task_operational_events;
CREATE POLICY task_operational_events_insert_policy
  ON public.task_operational_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- No UPDATE/DELETE policies: history is append-only by design.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.operational_motivos TO authenticated;
GRANT ALL ON TABLE public.operational_motivos TO service_role;

GRANT SELECT, INSERT ON TABLE public.task_operational_events TO authenticated;
GRANT ALL ON TABLE public.task_operational_events TO service_role;

-- Ensure PostgREST exposes the new tables immediately after migrate.
NOTIFY pgrst, 'reload schema';
