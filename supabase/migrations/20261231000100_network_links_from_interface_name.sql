-- Preserve the exact local interface name reported by discovery
-- (/ip/neighbor) on network_links, even when it does not match a
-- known network_interfaces row.

ALTER TABLE public.network_links
  ADD COLUMN IF NOT EXISTS from_interface_name text;

COMMENT ON COLUMN public.network_links.from_interface_name IS
  'Exact local interface name reported by discovery. Kept even when from_interface_id is null.';
