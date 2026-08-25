-- ISP 1.2.1 — Subscriber migration review + Clientes 360 access.
-- Additive. Safe if 1.2 already applied with the previous status check / maintenance-only RLS.

ALTER TABLE public.isp_migration_runs
  DROP CONSTRAINT IF EXISTS isp_migration_runs_status_check;

ALTER TABLE public.isp_migration_runs
  ADD CONSTRAINT isp_migration_runs_status_check
  CHECK (status IN (
    'validating',
    'pending_review',
    'validated',
    'rejected',
    'no_real_data',
    'completed',
    'failed'
  ));

CREATE OR REPLACE FUNCTION public.auth_can_manage_isp_migration()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.auth_user_has_allowed_module('maintenance')
      OR public.auth_user_has_allowed_module('clientes_360');
$$;

DROP POLICY IF EXISTS isp_migration_runs_select_360_policy ON public.isp_migration_runs;
CREATE POLICY isp_migration_runs_select_360_policy
  ON public.isp_migration_runs
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
  );

DROP POLICY IF EXISTS isp_migration_runs_write_360_policy ON public.isp_migration_runs;
CREATE POLICY isp_migration_runs_write_360_policy
  ON public.isp_migration_runs
  FOR ALL
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS isp_migration_staging_select_360_policy ON public.isp_migration_staging_rows;
CREATE POLICY isp_migration_staging_select_360_policy
  ON public.isp_migration_staging_rows
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
  );

DROP POLICY IF EXISTS isp_migration_staging_write_360_policy ON public.isp_migration_staging_rows;
CREATE POLICY isp_migration_staging_write_360_policy
  ON public.isp_migration_staging_rows
  FOR ALL
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  );

DROP POLICY IF EXISTS isp_company_settings_upsert_360_policy ON public.isp_company_settings;
CREATE POLICY isp_company_settings_upsert_360_policy
  ON public.isp_company_settings
  FOR ALL
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_can_manage_isp_migration()
    AND NOT public.auth_is_demo_platform_read_only()
  );

COMMENT ON FUNCTION public.auth_can_manage_isp_migration() IS
  'Maintenance or Clientes 360 may validate, review and confirm subscriber migrations.';

GRANT EXECUTE ON FUNCTION public.auth_can_manage_isp_migration() TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.isp_migration_staging_rows TO authenticated;

CREATE OR REPLACE FUNCTION public.import_isp_migration(
  p_run_id uuid,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_run public.isp_migration_runs%ROWTYPE;
  v_row public.isp_migration_staging_rows%ROWTYPE;
  v_payload jsonb;
  v_id uuid;
  v_existing_id uuid;
  v_existing_code text;
  v_catalog_id uuid;
  v_customer_id uuid;
  v_service_id uuid;
  v_connection_id uuid;
  v_dni_digits text;
  v_counts jsonb := jsonb_build_object(
    'catalog', 0,
    'customers', 0,
    'services', 0,
    'connections', 0,
    'equipment', 0,
    'reusedCustomers', 0,
    'skippedServices', 0,
    'skippedConnections', 0
  );
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT (
    public.auth_user_has_allowed_module('maintenance')
    OR public.auth_user_has_allowed_module('clientes_360')
  ) THEN
    RAISE EXCEPTION 'No tiene acceso a Migración de abonados.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'El entorno demo no permite importar abonados ISP.';
  END IF;

  SELECT * INTO v_run
  FROM public.isp_migration_runs
  WHERE id = p_run_id
    AND company_id = v_company_id;

  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'La migración no pertenece a esta empresa.';
  END IF;

  IF v_run.status = 'completed' THEN
    RAISE EXCEPTION 'Esta migración ya fue importada.';
  END IF;

  IF v_run.status NOT IN ('validated', 'pending_review')
    OR v_run.errors_count > 0 THEN
    RAISE EXCEPTION 'No se puede confirmar la migración mientras existan errores bloqueantes.';
  END IF;

  IF v_run.file_sha256 IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.isp_migration_runs previous
      WHERE previous.company_id = v_company_id
        AND previous.id <> v_run.id
        AND previous.status = 'completed'
        AND previous.file_sha256 = v_run.file_sha256
    )
    AND NOT COALESCE(p_force, false) THEN
    RAISE EXCEPTION 'Este archivo ya fue importado. Confirme una reimportación explícita.';
  END IF;

  DROP TABLE IF EXISTS tmp_isp_mig_catalog;
  DROP TABLE IF EXISTS tmp_isp_mig_customer;
  DROP TABLE IF EXISTS tmp_isp_mig_service;
  DROP TABLE IF EXISTS tmp_isp_mig_connection;

  CREATE TEMP TABLE tmp_isp_mig_catalog (
    external_code text PRIMARY KEY,
    id uuid NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_isp_mig_customer (
    external_code text PRIMARY KEY,
    id uuid NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_isp_mig_service (
    external_code text PRIMARY KEY,
    id uuid NOT NULL
  ) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_isp_mig_connection (
    external_code text PRIMARY KEY,
    id uuid NOT NULL
  ) ON COMMIT DROP;

  FOR v_row IN
    SELECT *
    FROM public.isp_migration_staging_rows
    WHERE run_id = p_run_id
      AND sheet = 'CATALOGO'
      AND validation_status IN ('valid', 'warning')
    ORDER BY row_number
  LOOP
    v_payload := v_row.payload;
    SELECT id INTO v_id
    FROM public.isp_service_catalog
    WHERE company_id = v_company_id
      AND deleted_at IS NULL
      AND lower(external_code) = lower(v_payload ->> 'catalogo_id_externo')
    LIMIT 1;

    IF v_id IS NULL THEN
      SELECT id INTO v_id
      FROM public.isp_service_catalog
      WHERE company_id = v_company_id
        AND deleted_at IS NULL
        AND lower(name) = lower(v_payload ->> 'nombre_servicio')
      LIMIT 1;
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO public.isp_service_catalog (
        company_id,
        external_code,
        name,
        category,
        customer_type,
        technology,
        download_speed_mbps,
        upload_speed_mbps,
        monthly_price,
        billing_period,
        billing_method,
        requires_connection,
        allowed_connection_types,
        description,
        is_active,
        is_seed
      )
      VALUES (
        v_company_id,
        NULLIF(btrim(v_payload ->> 'catalogo_id_externo'), ''),
        btrim(v_payload ->> 'nombre_servicio'),
        COALESCE(NULLIF(v_payload ->> 'category', ''), 'internet'),
        COALESCE(NULLIF(v_payload ->> 'customer_type', ''), 'residential'),
        NULLIF(v_payload ->> 'technology', ''),
        NULLIF(v_payload ->> 'download_speed_mbps', '')::integer,
        NULLIF(v_payload ->> 'upload_speed_mbps', '')::integer,
        NULLIF(v_payload ->> 'monthly_price', '')::numeric,
        COALESCE(NULLIF(v_payload ->> 'billing_period', ''), 'monthly'),
        COALESCE(NULLIF(v_payload ->> 'billing_method', ''), 'siro'),
        COALESCE((v_payload ->> 'requires_connection')::boolean, true),
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(v_payload -> 'allowed_connection_types')),
          '{}'::text[]
        ),
        NULLIF(btrim(v_payload ->> 'descripcion'), ''),
        COALESCE((v_payload ->> 'is_active')::boolean, true),
        false
      )
      RETURNING id INTO v_id;
      v_counts := jsonb_set(v_counts, '{catalog}', to_jsonb((v_counts ->> 'catalog')::integer + 1));
    ELSE
      UPDATE public.isp_service_catalog
      SET
        external_code = COALESCE(NULLIF(external_code, ''), NULLIF(btrim(v_payload ->> 'catalogo_id_externo'), '')),
        monthly_price = COALESCE(NULLIF(v_payload ->> 'monthly_price', '')::numeric, monthly_price),
        description = COALESCE(NULLIF(btrim(v_payload ->> 'descripcion'), ''), description)
      WHERE id = v_id;
    END IF;

    INSERT INTO tmp_isp_mig_catalog (external_code, id)
    VALUES (lower(v_payload ->> 'catalogo_id_externo'), v_id)
    ON CONFLICT (external_code) DO UPDATE SET id = EXCLUDED.id;
  END LOOP;

  FOR v_row IN
    SELECT *
    FROM public.isp_migration_staging_rows
    WHERE run_id = p_run_id
      AND sheet = 'CLIENTES'
      AND validation_status IN ('valid', 'warning')
    ORDER BY row_number
  LOOP
    v_payload := v_row.payload;
    v_dni_digits := regexp_replace(COALESCE(v_payload ->> 'dni_cuit', ''), '\D', '', 'g');

    SELECT id, external_customer_code
      INTO v_existing_id, v_existing_code
    FROM public.customers
    WHERE company_id = v_company_id
      AND deleted_at IS NULL
      AND lower(external_customer_code) = lower(v_payload ->> 'cliente_id_externo')
    LIMIT 1;

    IF v_existing_id IS NULL AND v_dni_digits <> '' THEN
      SELECT id, external_customer_code
        INTO v_existing_id, v_existing_code
      FROM public.customers
      WHERE company_id = v_company_id
        AND deleted_at IS NULL
        AND regexp_replace(COALESCE(dni, ''), '\D', '', 'g') = v_dni_digits
      LIMIT 1;

      IF v_existing_id IS NOT NULL
        AND NULLIF(btrim(COALESCE(v_existing_code, '')), '') IS NOT NULL
        AND lower(v_existing_code) IS DISTINCT FROM lower(v_payload ->> 'cliente_id_externo') THEN
        RAISE EXCEPTION 'El DNI/CUIT ya pertenece a otro cliente de esta empresa.';
      END IF;
    END IF;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.customers (
        company_id,
        customer_number,
        name,
        dni,
        phone,
        whatsapp,
        email,
        address,
        locality,
        status,
        status_reason,
        external_customer_code,
        validation_status
      )
      VALUES (
        v_company_id,
        public.next_isp_customer_number(v_company_id),
        btrim(v_payload ->> 'nombre_razon_social'),
        NULLIF(btrim(v_payload ->> 'dni_cuit'), ''),
        NULLIF(btrim(v_payload ->> 'telefono'), ''),
        NULLIF(btrim(v_payload ->> 'whatsapp'), ''),
        NULLIF(btrim(v_payload ->> 'email'), ''),
        NULLIF(btrim(v_payload ->> 'domicilio'), ''),
        NULLIF(btrim(v_payload ->> 'localidad'), ''),
        COALESCE(NULLIF(v_payload ->> 'customer_status', ''), 'activo'),
        NULLIF(btrim(v_payload ->> 'observaciones'), ''),
        NULLIF(btrim(v_payload ->> 'cliente_id_externo'), ''),
        'active'
      )
      RETURNING id INTO v_customer_id;
      v_counts := jsonb_set(v_counts, '{customers}', to_jsonb((v_counts ->> 'customers')::integer + 1));
    ELSE
      v_customer_id := v_existing_id;
      UPDATE public.customers
      SET external_customer_code = COALESCE(
        NULLIF(external_customer_code, ''),
        NULLIF(btrim(v_payload ->> 'cliente_id_externo'), '')
      )
      WHERE id = v_customer_id;
      v_counts := jsonb_set(
        v_counts,
        '{reusedCustomers}',
        to_jsonb((v_counts ->> 'reusedCustomers')::integer + 1)
      );
    END IF;

    INSERT INTO tmp_isp_mig_customer (external_code, id)
    VALUES (lower(v_payload ->> 'cliente_id_externo'), v_customer_id)
    ON CONFLICT (external_code) DO UPDATE SET id = EXCLUDED.id;
  END LOOP;

  FOR v_row IN
    SELECT *
    FROM public.isp_migration_staging_rows
    WHERE run_id = p_run_id
      AND sheet = 'SERVICIOS'
      AND validation_status IN ('valid', 'warning')
    ORDER BY row_number
  LOOP
    v_payload := v_row.payload;

    SELECT id INTO v_service_id
    FROM public.isp_services
    WHERE company_id = v_company_id
      AND deleted_at IS NULL
      AND lower(external_code) = lower(v_payload ->> 'servicio_id_externo')
    LIMIT 1;

    IF v_service_id IS NOT NULL THEN
      IF NOT COALESCE(p_force, false) THEN
        RAISE EXCEPTION 'Ya existe un servicio con este identificador.';
      END IF;
      INSERT INTO tmp_isp_mig_service (external_code, id)
      VALUES (lower(v_payload ->> 'servicio_id_externo'), v_service_id)
      ON CONFLICT (external_code) DO UPDATE SET id = EXCLUDED.id;
      v_counts := jsonb_set(
        v_counts,
        '{skippedServices}',
        to_jsonb((v_counts ->> 'skippedServices')::integer + 1)
      );
      CONTINUE;
    END IF;

    SELECT id INTO v_customer_id
    FROM tmp_isp_mig_customer
    WHERE external_code = lower(v_payload ->> 'cliente_id_externo');

    IF v_customer_id IS NULL THEN
      SELECT id INTO v_customer_id
      FROM public.customers
      WHERE company_id = v_company_id
        AND deleted_at IS NULL
        AND lower(external_customer_code) = lower(v_payload ->> 'cliente_id_externo')
      LIMIT 1;
    END IF;

    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'No existe un cliente con este identificador.';
    END IF;

    SELECT id INTO v_catalog_id
    FROM tmp_isp_mig_catalog
    WHERE external_code = lower(v_payload ->> 'catalogo_id_externo');

    IF v_catalog_id IS NULL THEN
      SELECT id INTO v_catalog_id
      FROM public.isp_service_catalog
      WHERE company_id = v_company_id
        AND deleted_at IS NULL
        AND lower(external_code) = lower(v_payload ->> 'catalogo_id_externo')
      LIMIT 1;
    END IF;

    IF v_catalog_id IS NULL THEN
      RAISE EXCEPTION 'No existe un servicio de catálogo con este identificador.';
    END IF;

    INSERT INTO public.isp_services (
      company_id,
      customer_id,
      catalog_id,
      external_code,
      technology,
      plan_name,
      contracted_speed,
      monthly_fee,
      activation_date,
      commercial_status,
      monthly_collection_method,
      notes,
      source_task_id
    )
    VALUES (
      v_company_id,
      v_customer_id,
      v_catalog_id,
      NULLIF(btrim(v_payload ->> 'servicio_id_externo'), ''),
      NULLIF(v_payload ->> 'technology', ''),
      COALESCE(NULLIF(btrim(v_payload ->> 'nombre_servicio'), ''), 'Servicio'),
      NULLIF(btrim(v_payload ->> 'contracted_speed'), ''),
      NULLIF(v_payload ->> 'monthly_price', '')::numeric,
      NULLIF(v_payload ->> 'fecha_alta', '')::date,
      COALESCE(NULLIF(v_payload ->> 'commercial_status', ''), 'active'),
      COALESCE(NULLIF(v_payload ->> 'billing_method', ''), 'siro'),
      NULLIF(btrim(v_payload ->> 'observaciones'), ''),
      NULL
    )
    RETURNING id INTO v_service_id;

    INSERT INTO tmp_isp_mig_service (external_code, id)
    VALUES (lower(v_payload ->> 'servicio_id_externo'), v_service_id)
    ON CONFLICT (external_code) DO UPDATE SET id = EXCLUDED.id;
    v_counts := jsonb_set(v_counts, '{services}', to_jsonb((v_counts ->> 'services')::integer + 1));
  END LOOP;

  FOR v_row IN
    SELECT *
    FROM public.isp_migration_staging_rows
    WHERE run_id = p_run_id
      AND sheet = 'CONEXIONES'
      AND validation_status IN ('valid', 'warning')
    ORDER BY row_number
  LOOP
    v_payload := v_row.payload;

    SELECT id INTO v_connection_id
    FROM public.isp_connections
    WHERE company_id = v_company_id
      AND deleted_at IS NULL
      AND lower(external_code) = lower(v_payload ->> 'conexion_id_externo')
    LIMIT 1;

    IF v_connection_id IS NOT NULL THEN
      IF NOT COALESCE(p_force, false) THEN
        RAISE EXCEPTION 'Ya existe una conexión con este identificador.';
      END IF;
      INSERT INTO tmp_isp_mig_connection (external_code, id)
      VALUES (lower(v_payload ->> 'conexion_id_externo'), v_connection_id)
      ON CONFLICT (external_code) DO UPDATE SET id = EXCLUDED.id;
      v_counts := jsonb_set(
        v_counts,
        '{skippedConnections}',
        to_jsonb((v_counts ->> 'skippedConnections')::integer + 1)
      );
      CONTINUE;
    END IF;

    SELECT id INTO v_service_id
    FROM tmp_isp_mig_service
    WHERE external_code = lower(v_payload ->> 'servicio_id_externo');

    IF v_service_id IS NULL THEN
      SELECT id INTO v_service_id
      FROM public.isp_services
      WHERE company_id = v_company_id
        AND deleted_at IS NULL
        AND lower(external_code) = lower(v_payload ->> 'servicio_id_externo')
      LIMIT 1;
    END IF;

    IF v_service_id IS NULL THEN
      RAISE EXCEPTION 'No existe un servicio con este identificador.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.isp_connections
      WHERE service_id = v_service_id
        AND deleted_at IS NULL
    ) THEN
      IF NOT COALESCE(p_force, false) THEN
        RAISE EXCEPTION 'El servicio ya tiene una conexión técnica.';
      END IF;
      CONTINUE;
    END IF;

    INSERT INTO public.isp_connections (
      company_id,
      service_id,
      external_code,
      connection_type,
      technical_status,
      pppoe_username,
      pppoe_password,
      ip_address,
      prefix_length,
      gateway,
      vlan,
      technical_profile,
      core_name,
      notes,
      provisioned_at,
      source_task_id
    )
    VALUES (
      v_company_id,
      v_service_id,
      NULLIF(btrim(v_payload ->> 'conexion_id_externo'), ''),
      COALESCE(NULLIF(v_payload ->> 'connection_type', ''), 'other'),
      COALESCE(NULLIF(v_payload ->> 'technical_status', ''), 'pending_provision'),
      NULLIF(btrim(v_payload ->> 'usuario_pppoe'), ''),
      NULLIF(v_payload ->> 'password_pppoe', ''),
      NULLIF(btrim(v_payload ->> 'ip'), ''),
      NULLIF(v_payload ->> 'prefijo', '')::integer,
      NULLIF(btrim(v_payload ->> 'gateway'), ''),
      NULLIF(btrim(v_payload ->> 'vlan'), ''),
      NULLIF(btrim(v_payload ->> 'perfil_tecnico'), ''),
      NULLIF(btrim(v_payload ->> 'core'), ''),
      NULLIF(btrim(v_payload ->> 'observaciones'), ''),
      NULLIF(v_payload ->> 'fecha_provisionamiento', '')::timestamptz,
      NULL
    )
    RETURNING id INTO v_connection_id;

    INSERT INTO tmp_isp_mig_connection (external_code, id)
    VALUES (lower(v_payload ->> 'conexion_id_externo'), v_connection_id)
    ON CONFLICT (external_code) DO UPDATE SET id = EXCLUDED.id;
    v_counts := jsonb_set(
      v_counts,
      '{connections}',
      to_jsonb((v_counts ->> 'connections')::integer + 1)
    );
  END LOOP;

  FOR v_row IN
    SELECT *
    FROM public.isp_migration_staging_rows
    WHERE run_id = p_run_id
      AND sheet = 'EQUIPAMIENTO'
      AND validation_status IN ('valid', 'warning')
    ORDER BY row_number
  LOOP
    v_payload := v_row.payload;

    IF EXISTS (
      SELECT 1
      FROM public.isp_connection_equipment
      WHERE company_id = v_company_id
        AND deleted_at IS NULL
        AND lower(external_code) = lower(v_payload ->> 'equipamiento_id_externo')
    ) THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_connection_id
    FROM tmp_isp_mig_connection
    WHERE external_code = lower(v_payload ->> 'conexion_id_externo');

    IF v_connection_id IS NULL THEN
      SELECT id INTO v_connection_id
      FROM public.isp_connections
      WHERE company_id = v_company_id
        AND deleted_at IS NULL
        AND lower(external_code) = lower(v_payload ->> 'conexion_id_externo')
      LIMIT 1;
    END IF;

    IF v_connection_id IS NULL THEN
      RAISE EXCEPTION 'No existe una conexión con este identificador.';
    END IF;

    INSERT INTO public.isp_connection_equipment (
      company_id,
      connection_id,
      external_code,
      equipment_type,
      brand,
      model,
      serial_number,
      mac,
      management_ip,
      olt,
      pon,
      port,
      tower,
      sector,
      cpe,
      onu,
      ont,
      notes
    )
    VALUES (
      v_company_id,
      v_connection_id,
      NULLIF(btrim(v_payload ->> 'equipamiento_id_externo'), ''),
      NULLIF(btrim(v_payload ->> 'tipo_equipo'), ''),
      NULLIF(btrim(v_payload ->> 'marca'), ''),
      NULLIF(btrim(v_payload ->> 'modelo'), ''),
      NULLIF(btrim(v_payload ->> 'numero_serie'), ''),
      NULLIF(btrim(v_payload ->> 'mac'), ''),
      NULLIF(btrim(v_payload ->> 'ip_gestion'), ''),
      NULLIF(btrim(v_payload ->> 'olt'), ''),
      NULLIF(btrim(v_payload ->> 'pon'), ''),
      NULLIF(btrim(v_payload ->> 'puerto'), ''),
      NULLIF(btrim(v_payload ->> 'torre'), ''),
      NULLIF(btrim(v_payload ->> 'sector'), ''),
      NULLIF(btrim(v_payload ->> 'cpe'), ''),
      NULLIF(btrim(v_payload ->> 'onu'), ''),
      NULLIF(btrim(v_payload ->> 'ont'), ''),
      NULLIF(btrim(v_payload ->> 'observaciones'), '')
    );
    v_counts := jsonb_set(v_counts, '{equipment}', to_jsonb((v_counts ->> 'equipment')::integer + 1));
  END LOOP;

  INSERT INTO public.isp_company_settings (company_id, onboarding_cutoff_at, updated_at, updated_by)
  VALUES (v_company_id, now(), now(), auth.uid())
  ON CONFLICT (company_id) DO UPDATE
    SET onboarding_cutoff_at = EXCLUDED.onboarding_cutoff_at,
        updated_at = now(),
        updated_by = auth.uid();

  UPDATE public.isp_migration_runs
  SET
    status = 'completed',
    completed_at = now(),
    imported_catalog_count = (v_counts ->> 'catalog')::integer,
    imported_customers_count = (v_counts ->> 'customers')::integer,
    imported_services_count = (v_counts ->> 'services')::integer,
    imported_connections_count = (v_counts ->> 'connections')::integer,
    imported_equipment_count = (v_counts ->> 'equipment')::integer,
    summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object('imported', v_counts),
    result_message = 'Migración de abonados completada. Se estableció la fecha de corte ISP.',
    updated_at = now()
  WHERE id = p_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'runId', p_run_id,
    'imported', v_counts,
    'cutoffAt', now()
  );
END;
$$;

COMMENT ON FUNCTION public.import_isp_migration(uuid, boolean) IS
  'Transactional ISP portfolio import from staging. Never infers customers, services or connections from historical OTs. PPPoE passwords are not included in the result.';

GRANT EXECUTE ON FUNCTION public.import_isp_migration(uuid, boolean) TO authenticated;

