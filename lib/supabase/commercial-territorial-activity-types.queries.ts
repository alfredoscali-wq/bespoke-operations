import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  CommercialTerritorialActivityType,
  CreateCommercialTerritorialActivityTypeInput,
  UpdateCommercialTerritorialActivityTypeInput,
} from "@/lib/types/commercial-territorial-activity"

type TypeRow = {
  id: string
  company_id: string
  name: string
  color: string
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type RepoError = { code: string; message: string }
type RepoResult<T> =
  | { data: T; error: null }
  | { data: null; error: RepoError }

function mapError(error: { code?: string; message: string }): RepoError {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

function mapRow(row: TypeRow): CommercialTerritorialActivityType {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

/** Loose client: table lands via migration ahead of generated Database types. */
export type CommercialTerritorialActivityTypesClient = SupabaseClient

const TABLE = "commercial_territorial_activity_types" as never

export async function listCommercialTerritorialActivityTypes(
  client: CommercialTerritorialActivityTypesClient,
  companyId: string,
  options?: { activeOnly?: boolean }
): Promise<RepoResult<CommercialTerritorialActivityType[]>> {
  let query = client
    .from(TABLE)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as TypeRow[]).map(mapRow),
    error: null,
  }
}

export async function createCommercialTerritorialActivityType(
  client: CommercialTerritorialActivityTypesClient,
  companyId: string,
  input: CreateCommercialTerritorialActivityTypeInput
): Promise<RepoResult<CommercialTerritorialActivityType>> {
  const name = input.name.trim()
  if (!name) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Ingrese el nombre del tipo." },
    }
  }

  const { data: existing } = await client
    .from(TABLE)
    .select("sort_order")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)

  const maxOrder =
    Array.isArray(existing) && existing[0]
      ? Number((existing[0] as { sort_order: number }).sort_order) || 0
      : 0

  const { data, error } = await client
    .from(TABLE)
    .insert({
      company_id: companyId,
      name,
      color: (input.color?.trim() || "#64748b").trim(),
      icon: input.icon?.trim() || null,
      sort_order: input.sortOrder ?? maxOrder + 1,
      is_active: input.isActive ?? true,
    } as never)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo crear el tipo." }),
    }
  }

  return { data: mapRow(data as TypeRow), error: null }
}

export async function updateCommercialTerritorialActivityType(
  client: CommercialTerritorialActivityTypesClient,
  companyId: string,
  id: string,
  input: UpdateCommercialTerritorialActivityTypeInput
): Promise<RepoResult<CommercialTerritorialActivityType>> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.color !== undefined) patch.color = input.color.trim() || "#64748b"
  if (input.icon !== undefined) patch.icon = input.icon?.trim() || null
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder
  if (input.isActive !== undefined) patch.is_active = input.isActive

  const { data, error } = await client
    .from(TABLE)
    .update(patch as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo actualizar el tipo." }),
    }
  }

  return { data: mapRow(data as TypeRow), error: null }
}

export async function softDeleteCommercialTerritorialActivityType(
  client: CommercialTerritorialActivityTypesClient,
  companyId: string,
  id: string
): Promise<RepoResult<true>> {
  const { error } = await client
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString(), is_active: false } as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: true, error: null }
}
