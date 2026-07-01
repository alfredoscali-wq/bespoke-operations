import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { listWorkOrderTypeChecklistItems } from "@/lib/supabase/work-order-type-checklist.queries"
import type { MobileOperationalChecklistItem } from "@/lib/mobile/v1/checklist/types"

type AdminClient = SupabaseClient<Database>

/**
 * Reserved for Field Agent: load the operational checklist template for a WO type.
 * Not exposed via API in Sprint 1.0.0A.
 */
export async function fetchOperationalChecklistForServiceType(
  client: AdminClient,
  companyId: string,
  serviceType: string
): Promise<MobileOperationalChecklistItem[]> {
  const result = await listWorkOrderTypeChecklistItems(
    client,
    companyId,
    serviceType
  )

  if (result.error || !result.data) {
    return []
  }

  return result.data.map((item) => ({
    id: item.id,
    title: item.title,
    required: item.required,
    requiresPhoto: item.requiresPhoto,
    sortOrder: item.sortOrder,
  }))
}
