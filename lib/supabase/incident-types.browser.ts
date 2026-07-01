import { createClient } from "@/lib/supabase/client"
import { resolveUniqueIncidentTypeCode } from "@/lib/incident-types/slugify"
import {
  countIncidentTypeUsage,
  createIncidentType,
  deleteIncidentType,
  listIncidentTypes,
  resolveNextIncidentTypeSortOrder,
  updateIncidentType,
  type SupabaseIncidentTypesClient,
} from "@/lib/supabase/incident-types.queries"
import type { IncidentType, IncidentTypeInput } from "@/lib/types/incident-types"

export function createBrowserIncidentTypesClient(): SupabaseIncidentTypesClient {
  return createClient()
}

export async function fetchIncidentTypes(
  companyId: string,
  client: SupabaseIncidentTypesClient = createBrowserIncidentTypesClient()
) {
  return listIncidentTypes(client, companyId)
}

export async function addIncidentType(
  companyId: string,
  item: IncidentTypeInput,
  existingCodes: string[],
  client: SupabaseIncidentTypesClient = createBrowserIncidentTypesClient()
): Promise<
  | { success: true; item: IncidentType }
  | { success: false; message: string }
> {
  const code = resolveUniqueIncidentTypeCode(item.name, existingCodes)
  const sortOrder = await resolveNextIncidentTypeSortOrder(client, companyId)

  const result = await createIncidentType(client, {
    companyId,
    code,
    sortOrder,
    item,
  })

  if (result.error || !result.data) {
    return {
      success: false,
      message: result.error?.message ?? "No se pudo crear el tipo de incidencia.",
    }
  }

  return { success: true, item: result.data }
}

export async function saveIncidentType(
  id: string,
  input: Partial<IncidentTypeInput>,
  client: SupabaseIncidentTypesClient = createBrowserIncidentTypesClient()
): Promise<
  | { success: true; item: IncidentType }
  | { success: false; message: string }
> {
  const result = await updateIncidentType(client, id, input)

  if (result.error || !result.data) {
    return {
      success: false,
      message:
        result.error?.message ?? "No se pudo guardar el tipo de incidencia.",
    }
  }

  return { success: true, item: result.data }
}

export async function removeIncidentType(
  id: string,
  client: SupabaseIncidentTypesClient = createBrowserIncidentTypesClient()
): Promise<{ success: true } | { success: false; message: string }> {
  const result = await deleteIncidentType(client, id)

  if (result.error) {
    return {
      success: false,
      message: result.error.message ?? "No se pudo eliminar el tipo de incidencia.",
    }
  }

  return { success: true }
}

export async function fetchIncidentTypeUsageCount(
  companyId: string,
  code: string,
  client: SupabaseIncidentTypesClient = createBrowserIncidentTypesClient()
): Promise<
  | { success: true; count: number }
  | { success: false; message: string }
> {
  const result = await countIncidentTypeUsage(client, companyId, code)

  if (result.error || result.data === null) {
    return {
      success: false,
      message:
        result.error?.message ??
        "No se pudo verificar el uso del tipo de incidencia.",
    }
  }

  return { success: true, count: result.data }
}
