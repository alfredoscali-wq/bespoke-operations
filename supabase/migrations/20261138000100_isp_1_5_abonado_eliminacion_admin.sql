-- ISP 1.5 — Administrative soft-delete of ISP subscriber membership.
-- Additive. Does not rewrite 1.4.1, customers, services, connections, OT or Atención.
-- Does not add deleted_at: isp_subscribers already has it.
-- Physical DELETE of customers / isp_services / isp_connections is out of scope.

CREATE OR REPLACE FUNCTION public.enforce_isp_subscriber_admin_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF NOT public.auth_is_administrador() THEN
      RAISE EXCEPTION 'Solo un administrador puede eliminar un abonado ISP.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_isp_subscriber_admin_soft_delete() IS
  'Blocks setting isp_subscribers.deleted_at unless the session role is Administrador. Restoring membership (deleted_at = NULL) remains allowed.';

DROP TRIGGER IF EXISTS isp_subscribers_admin_soft_delete ON public.isp_subscribers;
CREATE TRIGGER isp_subscribers_admin_soft_delete
  BEFORE UPDATE OF deleted_at ON public.isp_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_isp_subscriber_admin_soft_delete();

CREATE OR REPLACE FUNCTION public.remove_isp_subscriber_membership(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_row public.isp_subscribers%ROWTYPE;
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
    RAISE EXCEPTION 'Abonado no encontrado.';
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
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'alreadyRemoved', true
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'alreadyRemoved', false
  );
END;
$$;

COMMENT ON FUNCTION public.remove_isp_subscriber_membership(uuid) IS
  'Admin-only ISP membership soft-delete. Tenant comes from the session. Does not delete customers, services, connections, history or activity.';

GRANT EXECUTE ON FUNCTION public.remove_isp_subscriber_membership(uuid) TO authenticated;
