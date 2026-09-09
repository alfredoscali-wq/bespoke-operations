-- Harden public.auth_can_manage_isp_migration against function_search_path_mutable.
-- Does not change SECURITY INVOKER, arguments, or function body.
-- Used by ISP migration / subscriber RLS policies.

ALTER FUNCTION public.auth_can_manage_isp_migration()
  SET search_path = public;
