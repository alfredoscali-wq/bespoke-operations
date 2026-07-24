-- Tesorería 1.0.1 — Hard delete of movements (Administrador only).
-- Soft delete / cancel remain the normal operational path.

CREATE POLICY treasury_movements_delete_policy
  ON public.treasury_movements
  FOR DELETE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() = 'administrador'
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY treasury_receipts_delete_policy
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'treasury-receipts'
    AND public.auth_user_has_allowed_module('tesoreria')
    AND public.auth_user_system_role() = 'administrador'
    AND NOT public.auth_is_demo_platform_read_only()
    AND (storage.foldername(name))[1] = public.auth_user_company_id()::text
  );
