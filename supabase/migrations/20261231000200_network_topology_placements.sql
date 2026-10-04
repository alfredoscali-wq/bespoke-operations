-- Curated topology placements. Operator-defined parent → child.
-- Does not alter network_links, Discovery membership, Monitoring, or Alarms.

CREATE TABLE public.network_topology_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id),
  device_id uuid NOT NULL REFERENCES public.network_devices (id),
  parent_device_id uuid REFERENCES public.network_devices (id),
  parent_interface_id uuid REFERENCES public.network_interfaces (id),
  child_interface_id uuid REFERENCES public.network_interfaces (id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT network_topology_placements_not_self
    CHECK (device_id <> parent_device_id)
);

CREATE UNIQUE INDEX network_topology_placements_active_device_idx
  ON public.network_topology_placements (company_id, device_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_topology_placements_parent_idx
  ON public.network_topology_placements (company_id, parent_device_id)
  WHERE deleted_at IS NULL;

CREATE INDEX network_topology_placements_sort_idx
  ON public.network_topology_placements (company_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX network_topology_placements_device_idx
  ON public.network_topology_placements (company_id, device_id);

COMMENT ON TABLE public.network_topology_placements IS
  'Operator-curated topology: one active parent (or root) per device. Independent from discovered network_links.';

CREATE TRIGGER network_topology_placements_set_updated_at
  BEFORE UPDATE ON public.network_topology_placements
  FOR EACH ROW EXECUTE FUNCTION public.set_network_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_network_topology_placement_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_device public.network_devices%ROWTYPE;
  v_parent public.network_devices%ROWTYPE;
  v_if_company uuid;
BEGIN
  SELECT *
    INTO v_device
  FROM public.network_devices
  WHERE id = NEW.device_id
    AND deleted_at IS NULL;

  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'La colocación requiere un dispositivo existente.';
  END IF;

  IF v_device.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La colocación no puede cruzar empresas.';
  END IF;

  NEW.company_id := v_device.company_id;

  IF NEW.parent_device_id IS NOT NULL THEN
    SELECT *
      INTO v_parent
    FROM public.network_devices
    WHERE id = NEW.parent_device_id
      AND deleted_at IS NULL;

    IF v_parent.id IS NULL THEN
      RAISE EXCEPTION 'El padre de la colocación requiere un dispositivo existente.';
    END IF;

    IF v_parent.company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'La colocación no puede cruzar empresas.';
    END IF;
  END IF;

  IF NEW.parent_interface_id IS NOT NULL THEN
    IF NEW.parent_device_id IS NULL THEN
      RAISE EXCEPTION 'La interfaz del padre requiere un dispositivo padre.';
    END IF;

    SELECT company_id
      INTO v_if_company
    FROM public.network_interfaces
    WHERE id = NEW.parent_interface_id
      AND device_id = NEW.parent_device_id
      AND deleted_at IS NULL;

    IF v_if_company IS NULL THEN
      RAISE EXCEPTION 'La interfaz del padre no pertenece al dispositivo padre.';
    END IF;
  END IF;

  IF NEW.child_interface_id IS NOT NULL THEN
    SELECT company_id
      INTO v_if_company
    FROM public.network_interfaces
    WHERE id = NEW.child_interface_id
      AND device_id = NEW.device_id
      AND deleted_at IS NULL;

    IF v_if_company IS NULL THEN
      RAISE EXCEPTION 'La interfaz del hijo no pertenece al dispositivo colocado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER network_topology_placements_enforce_tenant
  BEFORE INSERT OR UPDATE ON public.network_topology_placements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_network_topology_placement_tenant();

ALTER TABLE public.network_topology_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY network_topology_placements_select_policy
  ON public.network_topology_placements
  FOR SELECT
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
  );

CREATE POLICY network_topology_placements_insert_policy
  ON public.network_topology_placements
  FOR INSERT
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

CREATE POLICY network_topology_placements_update_policy
  ON public.network_topology_placements
  FOR UPDATE
  USING (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  )
  WITH CHECK (
    company_id = public.auth_user_company_id()
    AND public.auth_user_has_allowed_module('network')
    AND NOT public.auth_is_demo_platform_read_only()
  );

GRANT SELECT, INSERT, UPDATE ON public.network_topology_placements TO authenticated;
