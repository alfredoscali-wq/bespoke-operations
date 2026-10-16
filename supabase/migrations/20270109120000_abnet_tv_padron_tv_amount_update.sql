-- Allows the subscriptions screen to store a confirmed LATAM plan
-- on the single padron row that was changed.

GRANT UPDATE (tv_amount) ON public.abnet_tv_padron_rows TO authenticated;

CREATE POLICY abnet_tv_padron_rows_update_tv_amount
  ON public.abnet_tv_padron_rows
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('subscriptions')
  );
