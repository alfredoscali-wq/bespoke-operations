import type { SupabaseClient } from "@supabase/supabase-js"

import { DEFAULT_COMMERCIAL_SOLICITUD_TYPE_SEEDS } from "@/lib/commercial/solicitud-catalogs"
import type {
  CommercialSolicitudType,
  CreateCommercialSolicitudTypeInput,
  UpdateCommercialSolicitudTypeInput,
} from "@/lib/types/commercial-solicitudes"

type TypeRow = {
  id: string
  company_id: string
  name: string
  color: string
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

export type CommercialSolicitudTypesClient = SupabaseClient

const TABLE = "commercial_solicitud_type_defs" as never

function mapError(error: { code?: string; message: string }): RepoError {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

function mapRow(row: TypeRow): CommercialSolicitudType {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export async function listCommercialSolicitudTypes(
  client: CommercialSolicitudTypesClient,
  companyId: string,
  options?: { activeOnly?: boolean }
): Promise<RepoResult<CommercialSolicitudType[]>> {
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

/** Insert default types when the company catalog is empty. */
export async function ensureDefaultCommercialSolicitudTypes(
  client: CommercialSolicitudTypesClient,
  companyId: string
): Promise<RepoResult<CommercialSolicitudType[]>> {
  const existing = await listCommercialSolicitudTypes(client, companyId)
  if (existing.error) return existing
  if ((existing.data?.length ?? 0) > 0) {
    return existing
  }

  for (const seed of DEFAULT_COMMERCIAL_SOLICITUD_TYPE_SEEDS) {
    const result = await createCommercialSolicitudType(client, companyId, {
      name: seed.name,
      color: seed.color,
      sortOrder: seed.sortOrder,
      isActive: true,
    })
    if (result.error) {
      return { data: null, error: result.error }
    }
  }

  return listCommercialSolicitudTypes(client, companyId)
}

export async function createCommercialSolicitudType(
  client: CommercialSolicitudTypesClient,
  companyId: string,
  input: CreateCommercialSolicitudTypeInput
): Promise<RepoResult<CommercialSolicitudType>> {
  const name = input.name.trim()
  if (!name) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Ingrese el nombre del tipo." },
    }
  }

  let sortOrder = input.sortOrder
  if (sortOrder == null) {
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
    sortOrder = maxOrder + 10
  }

  const { data, error } = await client
    .from(TABLE)
    .insert({
      company_id: companyId,
      name,
      color: input.color?.trim() || "#64748b",
      sort_order: sortOrder,
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

export async function updateCommercialSolicitudType(
  client: CommercialSolicitudTypesClient,
  companyId: string,
  id: string,
  input: UpdateCommercialSolicitudTypeInput
): Promise<RepoResult<CommercialSolicitudType>> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) {
      return {
        data: null,
        error: { code: "VALIDATION", message: "Ingrese el nombre del tipo." },
      }
    }
    patch.name = name
  }
  if (input.color !== undefined) patch.color = input.color.trim() || "#64748b"
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder
  if (input.isActive !== undefined) patch.is_active = input.isActive

  const { data, error } = await client
    .from(TABLE)
    .update(patch as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) return { data: null, error: mapError(error) }
  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Tipo no encontrado." },
    }
  }
  return { data: mapRow(data as TypeRow), error: null }
}

export async function softDeleteCommercialSolicitudType(
  client: CommercialSolicitudTypesClient,
  companyId: string,
  id: string
): Promise<RepoResult<true>> {
  const { error } = await client
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString(), is_active: false } as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (error) return { data: null, error: mapError(error) }
  return { data: true, error: null }
}
