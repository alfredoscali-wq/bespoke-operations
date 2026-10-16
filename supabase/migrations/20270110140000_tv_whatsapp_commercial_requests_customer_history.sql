-- Lets Clientes 360 read the WhatsApp requests already linked to a customer.
-- Unverified requests stay hidden because customer_id is null.
-- Also keeps Meta retries from inserting the same message twice.

ALTER TABLE public.tv_whatsapp_commercial_requests
  ADD COLUMN IF NOT EXISTS external_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS tv_whatsapp_commercial_requests_external_message_uidx
  ON public.tv_whatsapp_commercial_requests (company_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE POLICY tv_whatsapp_commercial_requests_customer_history_select_policy
  ON public.tv_whatsapp_commercial_requests
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.auth_user_company_id()
    AND customer_id IS NOT NULL
    AND public.auth_user_has_allowed_module('clientes_360')
  );
