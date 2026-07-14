import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { resolveWorkOrderTypeChecklistItems } from "@/lib/supabase/work-order-type-checklist.queries"
import type { MobileOperationalChecklistItem } from "@/lib/mobile/v1/checklist/types"
import type { WorkOrderTechnology } from "@/lib/tasks/work-order"

type AdminClient = SupabaseClient<Database>

/**
 * Load the operational checklist template for a WO type + technology.
 * Cascade: exact technology → "todas" → [].
 */
export async function fetchOperationalChecklistForServiceType(
  client: AdminClient,
  companyId: string,
  serviceType: string,
  technology?: WorkOrderTechnology | "" | null
): Promise<MobileOperationalChecklistItem[]> {
  const result = await resolveWorkOrderTypeChecklistItems(
    client,
    companyId,
    serviceType,
    technology
  )

  if (result.error || !result.data) {
    return []
  }

  return result.data.map((item) => ({
    id: item.id,
    title: item.title,
    fieldType: item.fieldType,
    required: item.required,
    sortOrder: item.sortOrder,
  }))
}
