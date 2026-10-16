-- Remembers inbound WhatsApp messages after Meta confirms the reply.
-- Service role writes it. Authenticated clients keep no privileges.

CREATE TABLE public.tv_whatsapp_processed_messages (
  company_id uuid NOT NULL REFERENCES public.companies (id),
  external_message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, external_message_id)
);

ALTER TABLE public.tv_whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tv_whatsapp_processed_messages FROM PUBLIC;
REVOKE ALL ON TABLE public.tv_whatsapp_processed_messages FROM anon;
REVOKE ALL ON TABLE public.tv_whatsapp_processed_messages FROM authenticated;
