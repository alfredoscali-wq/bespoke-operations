-- RC3.1.1 — Centro de Incidencias (backend infrastructure)
--
-- Note: public.incident_types already exists (20260906000100) as a tenant-scoped catalog
-- with company_id NOT NULL and extended configuration columns. This migration seeds the
-- standard operational codes per company and adds task_incidents + satellite tables.

-- ---------------------------------------------------------------------------
-- Seed — standard incident type catalog per tenant (existing table)
-- ---------------------------------------------------------------------------

INSERT INTO public.incident_types (
  company_id,
  code,
  name,
  description,
  color,
  pauses_work_order,
  requires_supervisor_intervention,
  notify_supervisor,
  is_active,
  sort_order
)
WITH standard_codes AS (
  SELECT *
  FROM (
    VALUES
      (
        'CLIENT_ABSENT',
        'Cliente ausente',
        'El cliente no se encuentra en el domicilio al momento de la visita.',
        true,
        1
      ),
      (
        'GPS_INCORRECT',
        'GPS incorrecto',
        'La ubicación GPS no coincide con el domicilio de servicio.',
        true,
        2
      ),
      (
        'NAP_NOT_FOUND',
        'NAP no encontrada',
        'No fue posible localizar la caja NAP en campo.',
        true,
        3
      ),
      (
        'PORT_OCCUPIED',
        'Puerto ocupado',
        'El puerto NAP requerido ya está en uso.',
        true,
        4
      ),
      (
        'MATERIAL_SHORTAGE',
        'Falta de material',
        'Faltan materiales necesarios para completar la orden de trabajo.',
        true,
        5
      ),
      (
        'NO_PROPERTY_ACCESS',
        'Sin acceso a la propiedad',
        'No se puede ingresar al domicilio o edificio para ejecutar la OT.',
        true,
        6
      ),
      (
        'CUSTOMER_RESCHEDULE',
        'Cliente solicita reprogramar',
        'El cliente pide reprogramar la visita.',
        false,
        7
      ),
      (
        'SAFETY_RISK',
        'Riesgo de seguridad',
        'Condiciones inseguras impiden continuar la ejecución.',
        true,
        8
      ),
      (
        'OTHER',
        'Otro',
        'Incidencia operativa no contemplada en el catálogo estándar.',
        true,
        9
      )
  ) AS seed (
    code,
    name,
    description,
    requires_supervisor_intervention,
    catalog_sort_order
  )
),
company_max_sort AS (
  SELECT
    c.id AS company_id,
    COALESCE(MAX(it.sort_order), 0) AS max_sort_order
  FROM public.companies c
  LEFT JOIN public.incident_types it
    ON it.company_id = c.id
  WHERE c.deleted_at IS NULL
  GROUP BY c.id
),
missing_codes AS (
  SELECT
    cms.company_id,
    sc.code,
    sc.name,
    sc.description,
    sc.requires_supervisor_intervention,
    cms.max_sort_order,
    ROW_NUMBER() OVER (
      PARTITION BY cms.company_id
      ORDER BY sc.catalog_sort_order
    ) AS relative_order
  FROM company_max_sort cms
  CROSS JOIN standard_codes sc
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.incident_types it
    WHERE it.company_id = cms.company_id
      AND it.code = sc.code
  )
)
SELECT
  mc.company_id,
  mc.code,
  mc.name,
  mc.description,
  '#64748b',
  true,
  mc.requires_supervisor_intervention,
  true,
  true,
  mc.max_sort_order + mc.relative_order
FROM missing_codes mc
ON CONFLICT (company_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- task_incidents
-- ---------------------------------------------------------------------------

CREATE TABLE public.task_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE RESTRICT,
  crew_id uuid NULL REFERENCES public.crews (id) ON DELETE SET NULL,
  incident_type_id uuid NOT NULL REFERENCES public.incident_types (id) ON DELETE RESTRICT,
  status text NOT NULL,
  comment text NULL,
  can_continue boolean NOT NULL DEFAULT false,
  requires_supervisor_action boolean NOT NULL DEFAULT true,
  resolved_by uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT task_incidents_status_check
    CHECK (status IN ('REPORTADA', 'EN_ANALISIS', 'RESUELTA', 'RECHAZADA')),
  CONSTRAINT task_incidents_resolved_pair_check
    CHECK (
      (resolved_at IS NULL AND resolved_by IS NULL)
      OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
    ),
  CONSTRAINT task_incidents_comment_not_blank
    CHECK (comment IS NULL OR char_length(trim(comment)) > 0)
);

CREATE UNIQUE INDEX task_incidents_one_active_per_task_idx
  ON public.task_incidents (task_id)
  WHERE deleted_at IS NULL
    AND status IN ('REPORTADA', 'EN_ANALISIS');

CREATE INDEX task_incidents_task_id_idx
  ON public.task_incidents (task_id);

CREATE INDEX task_incidents_employee_id_idx
  ON public.task_incidents (employee_id);

CREATE INDEX task_incidents_crew_id_idx
  ON public.task_incidents (crew_id)
  WHERE crew_id IS NOT NULL;

CREATE INDEX task_incidents_incident_type_id_idx
  ON public.task_incidents (incident_type_id);

CREATE INDEX task_incidents_company_status_idx
  ON public.task_incidents (company_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX task_incidents_created_at_desc_idx
  ON public.task_incidents (created_at DESC);

CREATE INDEX task_incidents_company_created_at_idx
  ON public.task_incidents (company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX task_incidents_deleted_at_idx
  ON public.task_incidents (deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON TABLE public.task_incidents IS
  'Operational incidents reported during work order execution (Centro de Incidencias).';

COMMENT ON INDEX public.task_incidents_one_active_per_task_idx IS
  'Ensures at most one active incident (REPORTADA or EN_ANALISIS) per work order.';

CREATE OR REPLACE FUNCTION public.set_task_incidents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_incidents_set_updated_at
  BEFORE UPDATE ON public.task_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_incidents_updated_at();

-- ---------------------------------------------------------------------------
-- task_incident_photos
-- ---------------------------------------------------------------------------

CREATE TABLE public.task_incident_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.task_incidents (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  thumbnail_path text NULL,
  file_name text NULL,
  mime_type text NULL,
  size_bytes bigint NULL,
  created_by uuid NOT NULL REFERENCES public.employees (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_incident_photos_storage_path_not_blank
    CHECK (char_length(trim(storage_path)) > 0),
  CONSTRAINT task_incident_photos_size_bytes_non_negative
    CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

CREATE INDEX task_incident_photos_incident_id_idx
  ON public.task_incident_photos (incident_id);

CREATE INDEX task_incident_photos_created_at_desc_idx
  ON public.task_incident_photos (created_at DESC);

COMMENT ON TABLE public.task_incident_photos IS
  'Evidence photos attached to a task incident (independent from task_photos).';

-- ---------------------------------------------------------------------------
-- task_incident_events (append-only audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE public.task_incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.task_incidents (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  comment text NULL,
  created_by uuid NOT NULL REFERENCES public.employees (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_incident_events_event_type_not_blank
    CHECK (char_length(trim(event_type)) > 0),
  CONSTRAINT task_incident_events_comment_not_blank
    CHECK (comment IS NULL OR char_length(trim(comment)) > 0)
);

CREATE INDEX task_incident_events_incident_id_idx
  ON public.task_incident_events (incident_id);

CREATE INDEX task_incident_events_incident_created_at_idx
  ON public.task_incident_events (incident_id, created_at DESC);

CREATE INDEX task_incident_events_created_at_desc_idx
  ON public.task_incident_events (created_at DESC);

COMMENT ON TABLE public.task_incident_events IS
  'Immutable incident lifecycle events for Centro de Incidencias.';

-- ---------------------------------------------------------------------------
-- Helpers — auth context for incident-center RLS (after task_incidents exists)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_system_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'user_metadata' ->> 'system_role', '');
$$;

COMMENT ON FUNCTION public.auth_user_system_role() IS
  'Authenticated user system_role from JWT user_metadata.';

CREATE OR REPLACE FUNCTION public.auth_user_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.app_user_id = auth.uid()
    AND e.deleted_at IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_user_employee_id() IS
  'Employee directory id for the authenticated Supabase user within the tenant.';

CREATE OR REPLACE FUNCTION public.auth_is_administrador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_system_role() = 'administrador';
$$;

CREATE OR REPLACE FUNCTION public.auth_is_supervisor_or_administrador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_system_role() IN ('administrador', 'supervisor');
$$;

CREATE OR REPLACE FUNCTION public.auth_operario_is_assigned_to_task_crew(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.deleted_at IS NULL
      AND t.company_id = public.auth_user_company_id()
      AND t.crew_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.crew_members cm
        JOIN public.employees e
          ON e.id = cm.employee_id
         AND e.deleted_at IS NULL
        WHERE cm.crew_id = t.crew_id
          AND cm.deleted_at IS NULL
          AND e.app_user_id = auth.uid()
      )
  );
$$;

COMMENT ON FUNCTION public.auth_operario_is_assigned_to_task_crew(uuid) IS
  'True when operario belongs to the crew currently assigned to the work order (creation gate).';

CREATE OR REPLACE FUNCTION public.auth_operario_can_access_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_operario_is_assigned_to_task_crew(p_task_id)
    OR EXISTS (
      SELECT 1
      FROM public.task_incidents ti
      WHERE ti.task_id = p_task_id
        AND ti.company_id = public.auth_user_company_id()
        AND ti.deleted_at IS NULL
        AND ti.employee_id = public.auth_user_employee_id()
    );
$$;

COMMENT ON FUNCTION public.auth_operario_can_access_task(uuid) IS
  'True when operario is on the assigned crew or reported a non-deleted incident on the work order (stable after replanning).';

CREATE OR REPLACE FUNCTION public.auth_can_read_task_incident(p_incident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_incidents ti
    WHERE ti.id = p_incident_id
      AND ti.company_id = public.auth_user_company_id()
      AND (
        public.auth_is_supervisor_or_administrador()
        OR public.auth_user_system_role() = 'administrativo'
        OR (
          public.auth_user_system_role() = 'operario'
          AND (
            public.auth_operario_can_access_task(ti.task_id)
            OR ti.employee_id = public.auth_user_employee_id()
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_can_manage_task_incident(p_incident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_incidents ti
    WHERE ti.id = p_incident_id
      AND ti.company_id = public.auth_user_company_id()
      AND NOT public.auth_is_demo_platform_read_only()
      AND (
        public.auth_is_administrador()
        OR public.auth_is_supervisor_or_administrador()
        OR (
          public.auth_user_system_role() = 'operario'
          AND ti.employee_id = public.auth_user_employee_id()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — task_incidents
-- ---------------------------------------------------------------------------

ALTER TABLE public.task_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_incidents_select_policy
  ON public.task_incidents
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND (
      public.auth_is_supervisor_or_administrador()
      OR public.auth_user_system_role() = 'administrativo'
      OR (
        public.auth_user_system_role() = 'operario'
        AND (
          public.auth_operario_can_access_task(task_id)
          OR employee_id = public.auth_user_employee_id()
        )
      )
    )
  );

CREATE POLICY task_incidents_insert_policy
  ON public.task_incidents
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND (
      public.auth_is_administrador()
      OR (
        public.auth_user_system_role() = 'operario'
        AND employee_id = public.auth_user_employee_id()
        AND public.auth_operario_is_assigned_to_task_crew(task_id)
      )
    )
  );

CREATE POLICY task_incidents_update_policy
  ON public.task_incidents
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND (
      public.auth_is_administrador()
      OR public.auth_user_system_role() = 'supervisor'
    )
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND (
      public.auth_is_administrador()
      OR public.auth_user_system_role() = 'supervisor'
    )
    AND (deleted_at IS NULL OR deleted_at IS NOT NULL)
  );

CREATE POLICY task_incidents_delete_policy
  ON public.task_incidents
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND NOT public.auth_is_demo_platform_read_only()
    AND public.auth_is_administrador()
  );

-- ---------------------------------------------------------------------------
-- RLS — task_incident_photos
-- ---------------------------------------------------------------------------

ALTER TABLE public.task_incident_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_incident_photos_select_policy
  ON public.task_incident_photos
  FOR SELECT
  USING (public.auth_can_read_task_incident(incident_id));

CREATE POLICY task_incident_photos_insert_policy
  ON public.task_incident_photos
  FOR INSERT
  WITH CHECK (
    public.auth_can_manage_task_incident(incident_id)
    AND created_by = public.auth_user_employee_id()
  );

-- ---------------------------------------------------------------------------
-- RLS — task_incident_events (append-only: SELECT + INSERT)
-- ---------------------------------------------------------------------------

ALTER TABLE public.task_incident_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_incident_events_select_policy
  ON public.task_incident_events
  FOR SELECT
  USING (public.auth_can_read_task_incident(incident_id));

CREATE POLICY task_incident_events_insert_policy
  ON public.task_incident_events
  FOR INSERT
  WITH CHECK (
    public.auth_can_manage_task_incident(incident_id)
    AND created_by = public.auth_user_employee_id()
  );
