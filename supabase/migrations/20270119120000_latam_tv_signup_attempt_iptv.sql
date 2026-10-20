-- Guarda el id_iptv confirmado por get-clients.
-- No copia el code de register-client. No borra intentos ni asociaciones.
--
-- Orden de despliegue: aplicar esta migración antes de publicar la aplicación.
-- La función finish instalada hasta ahora recibe tres argumentos. La aplicación
-- nueva envía p_id_iptv. Contra el esquema anterior el id_iptv no se persiste:
-- el intento queda pending_sync con la función vieja y no se repite register-client.
-- Publicar la aplicación primero no deja guardado el id_iptv.

ALTER TABLE public.latam_tv_signup_attempts
  ADD COLUMN IF NOT EXISTS id_iptv text;

COMMENT ON COLUMN public.latam_tv_signup_attempts.id_iptv IS
  'id_iptv confirmado en Latam. No es latam_code, id_crm ni el código de cliente de Bespoke.';

CREATE OR REPLACE FUNCTION public.read_latam_tv_signup_attempt(
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.auth_user_company_id();
  v_state text;
  v_code integer;
  v_iptv text;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'latam_signup_company_missing';
  END IF;
  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.auth_user_has_allowed_module('subscriptions')
     OR public.auth_user_system_role() NOT IN ('administrador', 'administrativo') THEN
    RAISE EXCEPTION 'latam_signup_forbidden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers
    WHERE id = p_customer_id
      AND company_id = v_company
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'latam_signup_customer_missing';
  END IF;

  SELECT state, latam_code, id_iptv
  INTO v_state, v_code, v_iptv
  FROM public.latam_tv_signup_attempts
  WHERE company_id = v_company
    AND customer_id = p_customer_id;

  RETURN jsonb_build_object(
    'state', v_state,
    'latam_code', v_code,
    'id_iptv', CASE
      WHEN v_iptv IS NOT NULL AND v_code IS NOT NULL AND v_iptv = v_code::text THEN NULL
      ELSE v_iptv
    END
  );
END;
$$;

DROP FUNCTION IF EXISTS public.finish_latam_tv_signup_attempt(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.finish_latam_tv_signup_attempt(
  p_customer_id uuid,
  p_state text,
  p_latam_code integer DEFAULT NULL,
  p_id_iptv text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.auth_user_company_id();
  v_row public.latam_tv_signup_attempts;
  v_iptv text := nullif(btrim(p_id_iptv), '');
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'latam_signup_company_missing';
  END IF;
  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.auth_user_has_allowed_module('subscriptions')
     OR public.auth_user_system_role() NOT IN ('administrador', 'administrativo') THEN
    RAISE EXCEPTION 'latam_signup_forbidden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_state NOT IN ('pending_sync', 'confirmed') THEN
    RAISE EXCEPTION 'latam_signup_state_invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers
    WHERE id = p_customer_id
      AND company_id = v_company
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'latam_signup_customer_missing';
  END IF;
  IF v_iptv IS NOT NULL AND v_iptv !~ '^[1-9][0-9]*$' THEN
    v_iptv := NULL;
  END IF;
  IF v_iptv IS NOT NULL AND p_latam_code IS NOT NULL AND v_iptv = p_latam_code::text THEN
    v_iptv := NULL;
  END IF;

  UPDATE public.latam_tv_signup_attempts
  SET state = p_state,
      latam_code = CASE
        WHEN latam_tv_signup_attempts.state = 'confirmed'
          THEN COALESCE(latam_tv_signup_attempts.latam_code, p_latam_code)
        ELSE COALESCE(p_latam_code, latam_tv_signup_attempts.latam_code)
      END,
      id_iptv = CASE
        WHEN v_iptv IS NULL THEN latam_tv_signup_attempts.id_iptv
        WHEN latam_tv_signup_attempts.latam_code IS NOT NULL
          AND v_iptv = latam_tv_signup_attempts.latam_code::text THEN latam_tv_signup_attempts.id_iptv
        WHEN latam_tv_signup_attempts.id_iptv IS NOT NULL
          AND latam_tv_signup_attempts.id_iptv <> v_iptv THEN latam_tv_signup_attempts.id_iptv
        ELSE v_iptv
      END,
      updated_at = now()
  WHERE company_id = v_company
    AND customer_id = p_customer_id
    AND (
      (state = 'register_sent' AND p_state IN ('pending_sync', 'confirmed'))
      OR (state = 'pending_sync' AND p_state IN ('pending_sync', 'confirmed'))
      OR (state = 'confirmed' AND p_state = 'confirmed')
    )
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object('saved', true, 'state', v_row.state, 'id_iptv', v_row.id_iptv);
  END IF;

  SELECT *
  INTO v_row
  FROM public.latam_tv_signup_attempts
  WHERE company_id = v_company
    AND customer_id = p_customer_id;

  RETURN jsonb_build_object(
    'saved', false,
    'state', CASE WHEN v_row.customer_id IS NULL THEN NULL ELSE v_row.state END,
    'id_iptv', v_row.id_iptv
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remember_latam_tv_signup_iptv(
  p_customer_id uuid,
  p_id_iptv text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.auth_user_company_id();
  v_iptv text := nullif(btrim(p_id_iptv), '');
  v_row public.latam_tv_signup_attempts;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'latam_signup_company_missing';
  END IF;
  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'DEMO_READ_ONLY'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.auth_user_has_allowed_module('subscriptions')
     OR public.auth_user_system_role() NOT IN ('administrador', 'administrativo') THEN
    RAISE EXCEPTION 'latam_signup_forbidden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers
    WHERE id = p_customer_id
      AND company_id = v_company
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'latam_signup_customer_missing';
  END IF;
  IF v_iptv IS NULL OR v_iptv !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'latam_signup_iptv_invalid';
  END IF;

  SELECT *
  INTO v_row
  FROM public.latam_tv_signup_attempts
  WHERE company_id = v_company
    AND customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.latam_tv_signup_attempts (
      company_id, customer_id, state, latam_code, id_iptv
    )
    VALUES (v_company, p_customer_id, 'confirmed', NULL, v_iptv)
    RETURNING * INTO v_row;
    RETURN jsonb_build_object('saved', true, 'state', v_row.state, 'id_iptv', v_row.id_iptv);
  END IF;

  IF v_row.latam_code IS NOT NULL AND v_iptv = v_row.latam_code::text THEN
    RETURN jsonb_build_object('saved', false, 'conflict', true, 'id_iptv', v_row.id_iptv);
  END IF;
  IF v_row.id_iptv IS NOT NULL AND v_row.id_iptv <> v_iptv THEN
    RETURN jsonb_build_object('saved', false, 'conflict', true, 'id_iptv', v_row.id_iptv);
  END IF;

  UPDATE public.latam_tv_signup_attempts
  SET id_iptv = v_iptv,
      state = CASE
        WHEN state = 'rejected' THEN 'confirmed'
        WHEN state = 'register_sent' THEN 'confirmed'
        WHEN state = 'pending_sync' THEN 'confirmed'
        ELSE state
      END,
      updated_at = now()
  WHERE company_id = v_company
    AND customer_id = p_customer_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('saved', true, 'state', v_row.state, 'id_iptv', v_row.id_iptv);
END;
$$;

REVOKE ALL ON FUNCTION public.read_latam_tv_signup_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_latam_tv_signup_attempt(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.finish_latam_tv_signup_attempt(uuid, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_latam_tv_signup_attempt(uuid, text, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.remember_latam_tv_signup_iptv(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remember_latam_tv_signup_iptv(uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.read_latam_tv_signup_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_latam_tv_signup_attempt(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remember_latam_tv_signup_iptv(uuid, text) TO authenticated;
