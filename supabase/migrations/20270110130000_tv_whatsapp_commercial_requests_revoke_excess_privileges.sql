-- Default privileges on this project grant every table privilege to anon and
-- authenticated. TRUNCATE is not covered by row level security. Leave only the
-- privileges governed by the existing inbox policies.

REVOKE ALL ON TABLE public.tv_whatsapp_commercial_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.tv_whatsapp_commercial_requests FROM anon;
REVOKE ALL ON TABLE public.tv_whatsapp_commercial_requests FROM authenticated;

GRANT SELECT, UPDATE ON TABLE public.tv_whatsapp_commercial_requests TO authenticated;
