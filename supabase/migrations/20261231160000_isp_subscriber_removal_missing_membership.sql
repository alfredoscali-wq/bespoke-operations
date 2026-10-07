-- Records an ISP membership soft-delete when Clientes 360 lists a customer
-- that has no isp_subscribers row yet. Does not delete customers, services,
-- connections, work orders, attentions or history, and does not change the
-- commercial universe.

CREATE OR REPLACE FUNCTION public.remove_isp_subscriber_membership(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_row public.isp_subscribers%ROWTYPE;
  v_customer_company uuid;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_is_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar un abonado ISP.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'La plataforma de demostración es de solo lectura.';
  END IF;

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Indique el abonado.';
  END IF;

  SELECT *
    INTO v_row
  FROM public.isp_subscribers
  WHERE company_id = v_company_id
    AND customer_id = p_customer_id;

  IF NOT FOUND THEN
    SELECT company_id
      INTO v_customer_company
    FROM public.customers
    WHERE id = p_customer_id
      AND company_id = v_company_id
      AND deleted_at IS NULL;

    IF v_customer_company IS NULL THEN
      RAISE EXCEPTION 'Abonado no encontrado.';
    END IF;

    INSERT INTO public.isp_subscribers (
      company_id,
      customer_id,
      source,
      deleted_at
    )
    VALUES (
      v_company_id,
      p_customer_id,
      'onboarding',
      now()
    );

    RETURN jsonb_build_object(
      'success', true,
      'alreadyRemoved', false
    );
  END IF;

  IF v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'alreadyRemoved', true
    );
  END IF;

  UPDATE public.isp_subscribers
  SET deleted_at = now()
  WHERE id = v_row.id
    AND company_id = v_company_id
    AND customer_id = p_customer_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo eliminar el abonado.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'alreadyRemoved', false
  );
END;
$$;

COMMENT ON FUNCTION public.remove_isp_subscriber_membership(uuid) IS
  'Admin-only ISP membership soft-delete. A listed customer without a membership row gets a removed membership. Does not delete customers, services, connections, history or activity.';
