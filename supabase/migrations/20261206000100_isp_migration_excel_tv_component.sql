-- Importador Excel 1.0 — resolve commercial catalog + TV component.
-- Does not add a plan_tv Excel column.
-- Does not create a second isp_services row for TV.
-- Does not use subscription_* tables.
-- Does not change billing or SIRO.
-- TV is read from isp_service_catalog.tv_plan_catalog_id of the contracted commercial service.

CREATE OR REPLACE FUNCTION public.resolve_isp_migration_catalog_id(
  p_company_id uuid,
  p_resolved_id text,
  p_external_code text,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_id := NULLIF(btrim(COALESCE(p_resolved_id, '')), '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_id := NULL;
  END;

  IF v_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.isp_service_catalog
      WHERE id = v_id
        AND company_id = p_company_id
        AND deleted_at IS NULL
    ) THEN
      RETURN v_id;
    END IF;
    v_id := NULL;
  END IF;

  IF NULLIF(btrim(COALESCE(p_external_code, '')), '') IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.isp_service_catalog
    WHERE company_id = p_company_id
      AND deleted_at IS NULL
      AND lower(external_code) = lower(btrim(p_external_code))
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;

    SELECT id INTO v_id
    FROM public.isp_service_catalog
    WHERE company_id = p_company_id
      AND deleted_at IS NULL
      AND lower(code) = lower(btrim(p_external_code))
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF NULLIF(btrim(COALESCE(p_name, '')), '') IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.isp_service_catalog
    WHERE company_id = p_company_id
      AND deleted_at IS NULL
      AND lower(name) = lower(btrim(p_name))
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.resolve_isp_migration_catalog_id(uuid, text, text, text) IS
  'Company-scoped commercial catalog lookup for ISP migration. Never infers TV from the name.';

GRANT EXECUTE ON FUNCTION public.resolve_isp_migration_catalog_id(uuid, text, text, text) TO authenticated;

DO $$
DECLARE
  v_src text;
  v_old text;
  v_new text;
BEGIN
  SELECT prosrc INTO v_src
  FROM pg_proc
  WHERE oid = 'public.import_isp_migration_core(uuid, boolean)'::regprocedure;

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'import_isp_migration_core(uuid, boolean) was not found.';
  END IF;

  v_old := $old$
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
  $old$;

  v_new := $new$
    v_catalog_id := public.resolve_isp_migration_catalog_id(
      v_company_id,
      v_payload ->> 'resolved_catalog_id',
      v_payload ->> 'catalogo_id_externo',
      v_payload ->> 'nombre_servicio'
    );

    IF v_catalog_id IS NULL THEN
      SELECT id INTO v_catalog_id
      FROM tmp_isp_mig_catalog
      WHERE external_code = lower(v_payload ->> 'catalogo_id_externo');
    END IF;

    IF v_catalog_id IS NULL THEN
      RAISE EXCEPTION 'Servicio no encontrado en el catálogo de la empresa.';
    END IF;

    IF NULLIF(btrim(COALESCE(v_payload ->> 'tv_plan_catalog_id', '')), '') IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.isp_service_catalog commercial
        WHERE commercial.id = v_catalog_id
          AND commercial.company_id = v_company_id
          AND commercial.deleted_at IS NULL
          AND commercial.tv_plan_catalog_id
            = NULLIF(btrim(v_payload ->> 'tv_plan_catalog_id'), '')::uuid
      ) THEN
        RAISE EXCEPTION 'El servicio % referencia un plan TV inexistente o inválido.',
          COALESCE(NULLIF(btrim(v_payload ->> 'nombre_servicio'), ''), 'comercial');
      END IF;
    END IF;
  $new$;

  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'Could not patch import_isp_migration_core catalog lookup.';
  END IF;

  EXECUTE
    'CREATE OR REPLACE FUNCTION public.import_isp_migration_core(p_run_id uuid, p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$'
    || replace(v_src, v_old, v_new)
    || '$fn$;';
END
$$;

COMMENT ON FUNCTION public.import_isp_migration_core(uuid, boolean) IS
  'Transactional ISP portfolio import. One commercial isp_services row per SERVICIOS line. TV is not a second contracted service.';

GRANT EXECUTE ON FUNCTION public.import_isp_migration_core(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_isp_migration(uuid, boolean) TO authenticated;
