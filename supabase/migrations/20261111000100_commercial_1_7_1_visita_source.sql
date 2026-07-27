-- Comercial 1.7.1 — origen Visita Comercial (selector de origen).

INSERT INTO public.commercial_sources (code, label, sort_order) VALUES
  ('visita_comercial', 'Visita Comercial', 25)
ON CONFLICT (code) DO NOTHING;
