-- RC3.1 — Fix effective EXECUTE grants on supervisor reschedule RPC and internal helper.
--
-- Root cause: Supabase default privileges grant EXECUTE on new public functions to
-- anon and authenticated. REVOKE FROM PUBLIC alone does not remove those explicit
-- role grants created at function creation/replacement time.

-- ---------------------------------------------------------------------------
-- Internal helper — callable only from SECURITY DEFINER RPC as function owner
-- Signature: apply_dispatch_order_updates(uuid, jsonb)
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.apply_dispatch_order_updates(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_dispatch_order_updates(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_dispatch_order_updates(uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_dispatch_order_updates(uuid, jsonb) FROM service_role;

-- ---------------------------------------------------------------------------
-- Server-side RPC — admin client / service_role only
-- Signature: supervisor_reschedule_active_task_from_incident(
--   uuid, uuid, uuid, uuid, date, text, uuid, text, text, text, text, text,
--   jsonb, date, text, jsonb, jsonb, text)
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.supervisor_reschedule_active_task_from_incident(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  date,
  text,
  jsonb,
  jsonb,
  text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.supervisor_reschedule_active_task_from_incident(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  date,
  text,
  jsonb,
  jsonb,
  text
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.supervisor_reschedule_active_task_from_incident(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  date,
  text,
  jsonb,
  jsonb,
  text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.supervisor_reschedule_active_task_from_incident(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  date,
  text,
  jsonb,
  jsonb,
  text
) TO service_role;
