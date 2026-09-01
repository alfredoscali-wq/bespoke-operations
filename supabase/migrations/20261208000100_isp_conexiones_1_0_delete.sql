-- CONEXIONES 1.0 — logical delete of a technical connection (deleted_at).
-- Does not delete customers, isp_services, catalog, TV plans or other connections.
-- Related child rows are not cascaded from this change.
--
-- Future physical customer delete (out of scope) must follow this order:
--   1. isp_connection_equipment
--   2. isp_connections
--   3. isp_services  (current blocker: isp_services_customer_id_fkey)
--   4. isp_subscribers
--   5. customers
-- Unique(service_id) becomes partial so a service can receive a new connection
-- after the previous technical circuit is removed.

ALTER TABLE public.isp_connections
  DROP CONSTRAINT IF EXISTS isp_connections_service_unique;

CREATE UNIQUE INDEX IF NOT EXISTS isp_connections_service_active_idx
  ON public.isp_connections (service_id)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.isp_connections_service_active_idx IS
  'One active technical connection per contracted service. Soft-deleted rows do not occupy the slot.';
