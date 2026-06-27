-- Bespoke Operations — Multi-tenant isolation (Demo Platform audit fix)
-- Separates production data from Bespoke Demo tenant.
-- Keep UUIDs in sync with lib/supabase/company.constants.ts

INSERT INTO public.companies (id, name, slug)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'Bespoke Operations',
  'bespoke-operations'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug;

-- customers.company_id
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.customers
SET company_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE company_id IS NULL
  AND (
    external_customer_code LIKE 'DEMO-SEED-%'
    OR customer_number LIKE 'DEMO-SEED-%'
  );

UPDATE public.customers
SET company_id = '00000000-0000-4000-8000-000000000002'::uuid
WHERE company_id IS NULL;

ALTER TABLE public.customers
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.customers
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000002'::uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_company_id_fkey'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS customers_company_id_idx ON public.customers (company_id);

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_customer_number_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_company_number_unique'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_company_number_unique UNIQUE (company_id, customer_number);
  END IF;
END $$;

-- Reassign operational rows that were incorrectly stored under the demo tenant
UPDATE public.employees
SET company_id = '00000000-0000-4000-8000-000000000002'::uuid
WHERE company_id = '00000000-0000-4000-8000-000000000001'::uuid
  AND employee_code NOT LIKE 'DEMO-EMP-%';

UPDATE public.tasks
SET company_id = '00000000-0000-4000-8000-000000000002'::uuid
WHERE company_id = '00000000-0000-4000-8000-000000000001'::uuid
  AND code NOT LIKE 'DEMO-%';

UPDATE public.projects
SET company_id = '00000000-0000-4000-8000-000000000002'::uuid
WHERE company_id = '00000000-0000-4000-8000-000000000001'::uuid
  AND code NOT LIKE 'DEMO-OB-%';

UPDATE public.crews
SET company_id = '00000000-0000-4000-8000-000000000002'::uuid
WHERE company_id = '00000000-0000-4000-8000-000000000001'::uuid
  AND name NOT LIKE 'Cuadrilla Demo %';

UPDATE public.evidences
SET company_id = '00000000-0000-4000-8000-000000000002'::uuid
WHERE company_id = '00000000-0000-4000-8000-000000000001'::uuid
  AND (file_name IS NULL OR file_name NOT LIKE 'demo-seed-%');

UPDATE public.employee_availability ea
SET company_id = e.company_id
FROM public.employees e
WHERE ea.employee_id = e.id
  AND ea.company_id IS DISTINCT FROM e.company_id;

UPDATE public.project_history ph
SET company_id = p.company_id
FROM public.projects p
WHERE ph.project_id = p.id
  AND ph.company_id IS DISTINCT FROM p.company_id;

-- Default new rows to production tenant
ALTER TABLE public.employees
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000002'::uuid;

ALTER TABLE public.tasks
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000002'::uuid;

ALTER TABLE public.projects
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000002'::uuid;

ALTER TABLE public.crews
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000002'::uuid;

ALTER TABLE public.evidences
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000002'::uuid;

ALTER TABLE public.employee_availability
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000002'::uuid;

-- system_audit_log.company_id
ALTER TABLE public.system_audit_log
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.system_audit_log
SET company_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE company_id IS NULL
  AND COALESCE((metadata->>'demoSeed')::boolean, false) IS TRUE;

UPDATE public.system_audit_log
SET company_id = '00000000-0000-4000-8000-000000000002'::uuid
WHERE company_id IS NULL;

ALTER TABLE public.system_audit_log
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.system_audit_log
  ALTER COLUMN company_id SET DEFAULT '00000000-0000-4000-8000-000000000002'::uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_audit_log_company_id_fkey'
  ) THEN
    ALTER TABLE public.system_audit_log
      ADD CONSTRAINT system_audit_log_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS system_audit_log_company_id_idx
  ON public.system_audit_log (company_id, created_at DESC);

COMMENT ON COLUMN public.customers.company_id IS 'Tenant owner of the customer record.';
COMMENT ON COLUMN public.system_audit_log.company_id IS 'Tenant scope for system audit history.';
