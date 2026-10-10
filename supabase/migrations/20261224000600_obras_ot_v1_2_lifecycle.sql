-- OTs de Obra V1.2: OT programada sin iniciar Obra, due_date opcional,
-- checklist en preliminares, y mensaje de finalización.

-- 1) due_date opcional en OT de Obra (y el resto de tasks).
ALTER TABLE public.tasks
  ALTER COLUMN due_date DROP NOT NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_dates_valid;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_dates_valid
  CHECK (
    due_date IS NULL
    OR start_date IS NULL
    OR due_date >= start_date
  );

-- 2) Checklist individual de cada preliminar (no es el catálogo global).
ALTER TABLE public.project_design_ot_proposals
  ADD COLUMN IF NOT EXISTS operational_checklist_template jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3) INSERT de OT de Obra: programada aunque la Obra siga planned.
CREATE OR REPLACE FUNCTION public.enforce_task_status_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project_status public.project_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.project_id IS NOT NULL AND NEW.crew_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.crews c
        WHERE c.id = NEW.crew_id
          AND c.company_id = NEW.company_id
          AND c.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = 'check_violation',
          MESSAGE = 'La cuadrilla no pertenece a la compañía de la tarea o está archivada.';
      END IF;
    END IF;

    IF NEW.project_id IS NOT NULL THEN
      SELECT p.status
      INTO v_project_status
      FROM public.projects p
      WHERE p.id = NEW.project_id
        AND p.company_id = NEW.company_id
        AND p.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING
          ERRCODE = 'check_violation',
          MESSAGE = 'La obra no existe, está eliminada o no pertenece al mismo tenant.';
      END IF;

      IF v_project_status IN (
        'active'::public.project_status,
        'planned'::public.project_status
      ) THEN
        NEW.status := 'programada'::public.task_status;
        RETURN NEW;
      END IF;

      NEW.status := 'borrador'::public.task_status;
      RETURN NEW;
    END IF;

    IF NEW.status NOT IN (
      'programada'::public.task_status,
      'pendiente'::public.task_status
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Las órdenes de trabajo nuevas deben crearse en estado programada.';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_allowed_task_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Transición de estado no permitida: %s → %s.',
        OLD.status,
        NEW.status
      );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_task_status_workflow() IS
  'Enforces task status workflow. OTs de Obra V1.2: INSERT planned|active → programada.';

-- 4) Finalizar Obra: mensaje claro + borrador también bloquea.
CREATE OR REPLACE FUNCTION public.finalize_project_operational(
  p_company_id uuid,
  p_project_id uuid,
  p_actor_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_open_task_count integer := 0;
  v_actor text := nullif(trim(COALESCE(p_actor_display_name, '')), '');
  v_previous_status public.project_status;
  v_history_description text;
  v_previous_status_label text;
BEGIN
  IF p_company_id IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'invalid_parameter_value',
      MESSAGE = 'Parámetros obligatorios incompletos para finalizar la obra.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'insufficient_privilege',
      MESSAGE = 'La plataforma de demostración es de solo lectura.';
  END IF;

  SELECT *
  INTO v_project
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.company_id = p_company_id
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'foreign_key_violation',
      MESSAGE = 'Obra no encontrada.';
  END IF;

  v_previous_status := v_project.status;

  IF v_previous_status NOT IN (
    'active'::public.project_status,
    'paused'::public.project_status
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Solo se puede finalizar una obra en estado Activa o Pausada.';
  END IF;

  SELECT count(*)::integer
  INTO v_open_task_count
  FROM public.tasks t
  WHERE t.project_id = p_project_id
    AND t.company_id = p_company_id
    AND t.deleted_at IS NULL
    AND t.status IN (
      'borrador'::public.task_status,
      'programada'::public.task_status,
      'asignada'::public.task_status,
      'vencida'::public.task_status,
      'en-curso'::public.task_status,
      'incidencia'::public.task_status,
      'pendiente-cierre'::public.task_status,
      'en-aprobacion'::public.task_status,
      'pendiente'::public.task_status
    );

  IF v_open_task_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'No se puede finalizar la Obra porque todavía hay OTs pendientes de ejecución. Hay %s OTs pendientes de ejecución.',
        v_open_task_count
      );
  END IF;

  UPDATE public.projects p
  SET
    status = 'closed'::public.project_status,
    updated_at = now()
  WHERE p.id = p_project_id
    AND p.company_id = p_company_id
    AND p.deleted_at IS NULL;

  v_previous_status_label := CASE v_previous_status
    WHEN 'active'::public.project_status THEN 'Activa'
    WHEN 'paused'::public.project_status THEN 'Pausada'
    ELSE v_previous_status::text
  END;

  v_history_description := format(
    'Estado actualizado de %s a Finalizada.',
    v_previous_status_label
  );

  INSERT INTO public.project_history (
    company_id,
    project_id,
    event_type,
    title,
    description,
    metadata,
    created_by
  )
  VALUES (
    p_company_id,
    p_project_id,
    'status_changed',
    'Cambio de estado',
    v_history_description,
    jsonb_build_object(
      'previousStatus', v_previous_status::text,
      'nextStatus', 'closed',
      'openTaskCount', v_open_task_count
    ),
    v_actor
  );

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'previous_status', v_previous_status::text,
    'next_status', 'closed',
    'open_task_count', v_open_task_count
  );
END;
$$;
