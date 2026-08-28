-- Soft delete for billing documents (comprobantes de prueba).
-- Does not change numbering, snapshots, fiscal fields, or physical rows.

ALTER TABLE public.isp_billing_documents
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.isp_billing_documents.deleted_at IS
  'Soft delete timestamp. Deleted comprobantes stay in DB for audit and numbering history.';

CREATE INDEX IF NOT EXISTS isp_billing_documents_company_active_idx
  ON public.isp_billing_documents (company_id, issue_date DESC, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.isp_billing_document_events
  DROP CONSTRAINT IF EXISTS isp_billing_document_events_event_type_check;

ALTER TABLE public.isp_billing_document_events
  ADD CONSTRAINT isp_billing_document_events_event_type_check
  CHECK (event_type IN ('created', 'updated', 'issued', 'cancelled', 'deleted'));

CREATE OR REPLACE FUNCTION public.soft_delete_isp_billing_document(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.auth_user_company_id();
  v_doc public.isp_billing_documents%ROWTYPE;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa no resuelta para la sesión.';
  END IF;

  IF NOT public.auth_is_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar comprobantes.';
  END IF;

  IF NOT public.auth_user_has_allowed_module('facturacion') THEN
    RAISE EXCEPTION 'No tiene permiso para eliminar comprobantes.';
  END IF;

  IF public.auth_is_demo_platform_read_only() THEN
    RAISE EXCEPTION 'El modo demostración no permite eliminar comprobantes.';
  END IF;

  SELECT * INTO v_doc
  FROM public.isp_billing_documents
  WHERE id = p_document_id
    AND company_id = v_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comprobante no encontrado.';
  END IF;

  UPDATE public.isp_billing_documents
  SET
    deleted_at = now(),
    updated_at = now()
  WHERE id = v_doc.id
    AND company_id = v_company_id;

  INSERT INTO public.isp_billing_document_events (
    company_id,
    document_id,
    event_type,
    payload
  )
  VALUES (
    v_company_id,
    v_doc.id,
    'deleted',
    jsonb_build_object(
      'previousStatus', v_doc.status,
      'documentType', v_doc.document_type
    )
  );

  RETURN jsonb_build_object(
    'id', v_doc.id,
    'deleted', true
  );
END;
$$;

COMMENT ON FUNCTION public.soft_delete_isp_billing_document(uuid) IS
  'Soft-deletes a billing document for administrators. Tenant-scoped; preserves snapshots and numbering.';

REVOKE ALL ON FUNCTION public.soft_delete_isp_billing_document(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_isp_billing_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_isp_billing_document(uuid) TO service_role;

DROP POLICY IF EXISTS isp_billing_documents_select_policy ON public.isp_billing_documents;

CREATE POLICY isp_billing_documents_select_policy
  ON public.isp_billing_documents
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('facturacion')
    AND deleted_at IS NULL
  );
