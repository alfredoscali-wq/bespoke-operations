import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { listActiveIncidentTypes } from "@/lib/supabase/incident-types.queries"
import type { MobileTaskIncidentType } from "@/lib/mobile/v1/tasks/types"

type AdminClient = SupabaseClient<Database>

type WorkOrderTypeIncidentTypeRow = {
  incident_type_id: string
  sort_order: number
}

function mapIncidentType(item: {
  id: string
  code: string
  name: string
  description: string
  color: string
  sortOrder: number
}): MobileTaskIncidentType {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    color: item.color,
    required: false,
    sortOrder: item.sortOrder,
  }
}

export async function fetchIncidentTypesForServiceType(
  client: AdminClient,
  companyId: string,
  serviceType: string | null | undefined
): Promise<MobileTaskIncidentType[]> {
  const normalizedServiceType = serviceType?.trim() || ""

  if (normalizedServiceType) {
    const configuredResult = await (
      client as SupabaseClient
    )
      .from("work_order_type_incident_types")
      .select("incident_type_id, sort_order")
      .eq("company_id", companyId)
      .eq("service_type", normalizedServiceType)
      .order("sort_order", { ascending: true })

    if (configuredResult.error) {
      throw configuredResult.error
    }

    const configuredRows =
      (configuredResult.data as WorkOrderTypeIncidentTypeRow[] | null) ?? []

    if (configuredRows.length > 0) {
      const activeResult = await listActiveIncidentTypes(client, companyId)

      if (activeResult.error || !activeResult.data) {
        return []
      }

      const activeById = new Map(
        activeResult.data.map((item) => [item.id, item] as const)
      )

      return configuredRows
        .map((row) => {
          const incidentType = activeById.get(row.incident_type_id)
          if (!incidentType) {
            return null
          }

          return mapIncidentType({
            id: incidentType.id,
            code: incidentType.code,
            name: incidentType.name,
            description: incidentType.description,
            color: incidentType.color,
            sortOrder: row.sort_order,
          })
        })
        .filter((item): item is MobileTaskIncidentType => item != null)
    }
  }

  const activeResult = await listActiveIncidentTypes(client, companyId)

  if (activeResult.error || !activeResult.data) {
    return []
  }

  return activeResult.data.map((item) =>
    mapIncidentType({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      color: item.color,
      sortOrder: item.sortOrder,
    })
  )
}
