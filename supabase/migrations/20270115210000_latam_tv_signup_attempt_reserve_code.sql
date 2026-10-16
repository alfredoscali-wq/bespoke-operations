-- Reports the stored register-client code when a reservation is denied.
-- The application uses a null code to close pending_sync after a complete
-- catalog miss. Codes 1 and 3, and any other stored code, stay blocked here.
-- This function does not insert a second row and does not call an external service.

CREATE OR REPLACE FUNCTION public.reserve_latam_tv_signup_attempt(
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.auth_user_company_id();
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

  INSERT INTO public.latam_tv_signup_attempts (company_id, customer_id, state)
  VALUES (v_company, p_customer_id, 'register_sent')
  ON CONFLICT (company_id, customer_id) DO UPDATE
    SET state = 'register_sent',
        latam_code = NULL,
        updated_at = now()
    WHERE latam_tv_signup_attempts.state = 'rejected'
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'granted', true,
      'state', v_row.state,
      'latam_code', v_row.latam_code
    );
  END IF;

  SELECT *
  INTO v_row
  FROM public.latam_tv_signup_attempts
  WHERE company_id = v_company
    AND customer_id = p_customer_id;

  RETURN jsonb_build_object(
    'granted', false,
    'state', v_row.state,
    'latam_code', v_row.latam_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_latam_tv_signup_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_latam_tv_signup_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_latam_tv_signup_attempt(uuid) TO authenticated;
