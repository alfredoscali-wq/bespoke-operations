import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapIncidentTypeInsert,
  mapIncidentTypeRowToItem,
  mapIncidentTypeUpdate,
} from "@/lib/supabase/incident-types.mapper"
import type { IncidentType, IncidentTypeInput } from "@/lib/types/incident-types"

export type SupabaseIncidentTypesClient = SupabaseClient<Database>

export type IncidentTypesRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } }

function mapError(error: { message: string }): { message: string } {
  return { message: error.message }
}

export async function listIncidentTypes(
  client: SupabaseIncidentTypesClient,
  companyId: string
): Promise<IncidentTypesRepositoryResult<IncidentType[]>> {
  const { data, error } = await client
    .from("incident_types")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapIncidentTypeRowToItem),
    error: null,
  }
}

export async function listActiveIncidentTypes(
  client: SupabaseIncidentTypesClient,
  companyId: string
): Promise<IncidentTypesRepositoryResult<IncidentType[]>> {
  const { data, error } = await client
    .from("incident_types")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapIncidentTypeRowToItem),
    error: null,
  }
}

export async function createIncidentType(
  client: SupabaseIncidentTypesClient,
  input: {
    companyId: string
    code: string
    sortOrder: number
    item: IncidentTypeInput
  }
): Promise<IncidentTypesRepositoryResult<IncidentType>> {
  const { data, error } = await client
    .from("incident_types")
    .insert(
      mapIncidentTypeInsert({
        companyId: input.companyId,
        code: input.code,
        sortOrder: input.sortOrder,
        item: input.item,
      })
    )
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo crear el tipo de incidencia." }),
    }
  }

  return { data: mapIncidentTypeRowToItem(data), error: null }
}

export async function updateIncidentType(
  client: SupabaseIncidentTypesClient,
  id: string,
  input: Partial<IncidentTypeInput>
): Promise<IncidentTypesRepositoryResult<IncidentType>> {
  const { data, error } = await client
    .from("incident_types")
    .update(mapIncidentTypeUpdate(input))
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(
        error ?? { message: "No se pudo actualizar el tipo de incidencia." }
      ),
    }
  }

  return { data: mapIncidentTypeRowToItem(data), error: null }
}

export async function deleteIncidentType(
  client: SupabaseIncidentTypesClient,
  id: string
): Promise<IncidentTypesRepositoryResult<true>> {
  const { error } = await client.from("incident_types").delete().eq("id", id)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: true, error: null }
}

export async function resolveNextIncidentTypeSortOrder(
  client: SupabaseIncidentTypesClient,
  companyId: string
): Promise<number> {
  const { data } = await client
    .from("incident_types")
    .select("sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.sort_order ?? 0) + 1
}

export async function countIncidentTypeUsage(
  client: SupabaseIncidentTypesClient,
  companyId: string,
  code: string
): Promise<IncidentTypesRepositoryResult<number>> {
  const { count, error } = await client
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("incident_reason", code)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: count ?? 0, error: null }
}
