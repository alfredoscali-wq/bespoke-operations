-- Remembers that a new TV signup already called Latam register-client.
-- One row per company and customer. No expiry: an uncertain attempt stays blocked.
-- Credentials and the Latam identifier stay out of this table.
-- reserve inserts register_sent, or reopens only a rejected row.
-- finish updates that row and never inserts another one.
-- finish cannot move any row to rejected. pending_sync, confirmed and
-- register_sent stay blocked against a direct release.
-- A confirmed latam_code is kept when a later finish does not supply a new code.

CREATE TABLE public.latam_tv_signup_attempts (
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  state text NOT NULL
    CHECK (state IN ('register_sent', 'pending_sync', 'confirmed', 'rejected')),
  latam_code integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, customer_id)
);

COMMENT ON TABLE public.latam_tv_signup_attempts IS
  'Persistent guard for a new Latam TV signup. register_sent, pending_sync and confirmed block another register-client.';
COMMENT ON COLUMN public.latam_tv_signup_attempts.latam_code IS
  'Numeric register-client code. Not the response body. A confirmed value is kept.';

ALTER TABLE public.latam_tv_signup_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.latam_tv_signup_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.latam_tv_signup_attempts FROM anon;
REVOKE ALL ON TABLE public.latam_tv_signup_attempts FROM authenticated;

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
    RETURN jsonb_build_object('granted', true, 'state', v_row.state);
  END IF;

  SELECT *
  INTO v_row
  FROM public.latam_tv_signup_attempts
  WHERE company_id = v_company
    AND customer_id = p_customer_id;

  RETURN jsonb_build_object('granted', false, 'state', v_row.state);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_latam_tv_signup_attempt(
  p_customer_id uuid,
  p_state text,
  p_latam_code integer DEFAULT NULL
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

  UPDATE public.latam_tv_signup_attempts
  SET state = p_state,
      latam_code = CASE
        WHEN latam_tv_signup_attempts.state = 'confirmed'
          THEN COALESCE(latam_tv_signup_attempts.latam_code, p_latam_code)
        ELSE COALESCE(p_latam_code, latam_tv_signup_attempts.latam_code)
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
    RETURN jsonb_build_object('saved', true, 'state', v_row.state);
  END IF;

  SELECT *
  INTO v_row
  FROM public.latam_tv_signup_attempts
  WHERE company_id = v_company
    AND customer_id = p_customer_id;

  RETURN jsonb_build_object(
    'saved', false,
    'state', CASE WHEN v_row.customer_id IS NULL THEN NULL ELSE v_row.state END
  );
END;
$$;

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

  SELECT state
  INTO v_state
  FROM public.latam_tv_signup_attempts
  WHERE company_id = v_company
    AND customer_id = p_customer_id;

  RETURN jsonb_build_object('state', v_state);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_latam_tv_signup_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_latam_tv_signup_attempt(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.read_latam_tv_signup_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_latam_tv_signup_attempt(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.finish_latam_tv_signup_attempt(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_latam_tv_signup_attempt(uuid, text, integer) FROM anon;

GRANT EXECUTE ON FUNCTION public.reserve_latam_tv_signup_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_latam_tv_signup_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_latam_tv_signup_attempt(uuid, text, integer) TO authenticated;
