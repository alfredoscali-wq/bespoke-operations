-- Atención al Cliente 1.0 — customer_atenciones + module visibility for atencion_cliente

CREATE TABLE IF NOT EXISTS public.customer_atenciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  attended_by_employee_id uuid NOT NULL REFERENCES public.employees (id),
  channel text NOT NULL,
  motivo text NOT NULL,
  detail text NOT NULL,
  resolution text NOT NULL,
  resultado text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT customer_atenciones_channel_check CHECK (
    channel IN ('telefono', 'whatsapp', 'presencial', 'otro')
  ),
  CONSTRAINT customer_atenciones_motivo_check CHECK (
    motivo IN (
      'consulta',
      'reclamo',
      'solicitud',
      'problema_tecnico',
      'facturacion',
      'baja',
      'retencion',
      'otro'
    )
  ),
  CONSTRAINT customer_atenciones_resultado_check CHECK (
    resultado IN ('resuelta', 'requiere_seguimiento', 'ot_creada')
  )
);

CREATE INDEX customer_atenciones_company_created_idx
  ON public.customer_atenciones (company_id, created_at DESC);

CREATE INDEX customer_atenciones_company_customer_idx
  ON public.customer_atenciones (company_id, customer_id);

CREATE INDEX customer_atenciones_company_employee_idx
  ON public.customer_atenciones (company_id, attended_by_employee_id);

CREATE OR REPLACE FUNCTION public.set_customer_atenciones_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customer_atenciones_set_updated_at
  BEFORE UPDATE ON public.customer_atenciones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_atenciones_updated_at();

COMMENT ON TABLE public.customer_atenciones IS
  'Customer service interactions recorded by Atención al Cliente.';

ALTER TABLE public.customer_atenciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_atenciones_select_policy
  ON public.customer_atenciones
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
  );

CREATE POLICY customer_atenciones_insert_policy
  ON public.customer_atenciones
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY customer_atenciones_update_policy
  ON public.customer_atenciones
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('atencion_cliente')
    AND NOT public.auth_is_demo_platform_read_only()
  );

-- Enable atencion_cliente module for Administrador, Administración and Atención al Cliente areas.
UPDATE public.company_roles
SET module_visibility = module_visibility || '{"atencion_cliente": true}'::jsonb
WHERE code IN ('administrador', 'administracion', 'atencion_cliente');
