import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { listActiveIncidentTypes } from "@/lib/supabase/incident-types.queries"
import type { MobileIncidentType } from "@/lib/mobile/v1/incidents/types"

type AdminClient = SupabaseClient<Database>

/**
 * Reserved for Field Agent: load active incident types for the tenant.
 * Not exposed via API in Sprint 1.0.0B.
 */
export async function fetchActiveIncidentTypesForCompany(
  client: AdminClient,
  companyId: string
): Promise<MobileIncidentType[]> {
  const result = await listActiveIncidentTypes(client, companyId)

  if (result.error || !result.data) {
    return []
  }

  return result.data.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    color: item.color,
    pausesWorkOrder: item.pausesWorkOrder,
    requiresSupervisorIntervention: item.requiresSupervisorIntervention,
    notifySupervisor: item.notifySupervisor,
    sortOrder: item.sortOrder,
  }))
}
