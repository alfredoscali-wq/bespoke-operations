-- A Bespoke CLI is a valid padrón customer number when the client has no
-- verified ABNet external code. The existing numeric check stays valid.
-- abnet_tv_padron_rows.abnet_customer_number remains NOT NULL.

ALTER TABLE public.tv_ot_signup_proposals
  DROP CONSTRAINT IF EXISTS tv_ot_signup_proposals_abnet_customer_number_check;

ALTER TABLE public.tv_ot_signup_proposals
  ADD CONSTRAINT tv_ot_signup_proposals_abnet_customer_number_check
  CHECK (
    abnet_customer_number IS NULL
    OR abnet_customer_number ~ '^[1-9][0-9]*$'
    OR abnet_customer_number ~ '^CLI-[0-9]+$'
  );

CREATE OR REPLACE FUNCTION public.guard_bespoke_ot_tv_padron_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source IS DISTINCT FROM 'bespoke-ot-tv' THEN
    RAISE EXCEPTION 'tv_ot_padron_source_rejected';
  END IF;
  IF btrim(coalesce(NEW.abnet_customer_number, '')) = ''
    OR btrim(coalesce(NEW.customer_name, '')) = ''
  THEN
    RAISE EXCEPTION 'tv_ot_padron_incomplete';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers customer
    WHERE customer.company_id = NEW.company_id
      AND customer.deleted_at IS NULL
      AND (
        (
          customer.external_customer_code ~ '^[0-9]+$'
          AND ltrim(customer.external_customer_code, '0') = ltrim(NEW.abnet_customer_number, '0')
        )
        OR btrim(customer.customer_number) = btrim(NEW.abnet_customer_number)
      )
  ) THEN
    RAISE EXCEPTION 'tv_ot_padron_unverified_number';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.abnet_tv_padron_rows existing
    WHERE existing.company_id = NEW.company_id
      AND ltrim(existing.abnet_customer_number, '0') = ltrim(NEW.abnet_customer_number, '0')
      AND NOT (
        existing.source = NEW.source
        AND existing.source_row = NEW.source_row
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.abnet_tv_padron_exclusions ex
        WHERE ex.company_id = existing.company_id
          AND ex.source = existing.source
          AND ex.source_row = existing.source_row
          AND ex.deleted_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'tv_ot_padron_duplicate_number';
  END IF;
  RETURN NEW;
END;
$$;
