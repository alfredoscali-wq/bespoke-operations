-- Replaces release_latam_tv_signup_attempt.
-- A pending_sync row with no latam_code and no id_iptv can close after a
-- complete catalog miss. That is not a LATAM rejection and not a code 1.
-- A stored code of 1 or 3 stays blocked.
-- A stored id_iptv stays blocked even when latam_code is null.
-- register_sent and confirmed stay blocked.
-- This function never inserts a row, never updates customers,
-- and never calls an external service.

CREATE OR REPLACE FUNCTION public.release_latam_tv_signup_attempt(
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

  UPDATE public.latam_tv_signup_attempts
  SET state = 'rejected',
      updated_at = now()
  WHERE company_id = v_company
    AND customer_id = p_customer_id
    AND state = 'pending_sync'
    AND (
      (latam_code IS NULL AND id_iptv IS NULL)
      OR (latam_code IS NOT NULL AND latam_code NOT IN (1, 3))
    )
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object('released', true, 'state', v_row.state);
  END IF;

  SELECT *
  INTO v_row
  FROM public.latam_tv_signup_attempts
  WHERE company_id = v_company
    AND customer_id = p_customer_id;

  RETURN jsonb_build_object(
    'released', false,
    'state', CASE WHEN v_row.customer_id IS NULL THEN NULL ELSE v_row.state END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_latam_tv_signup_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_latam_tv_signup_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.release_latam_tv_signup_attempt(uuid) TO authenticated;
