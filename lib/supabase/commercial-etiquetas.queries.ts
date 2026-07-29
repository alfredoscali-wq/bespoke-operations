import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  CommercialEtiqueta,
  CreateCommercialEtiquetaInput,
  UpdateCommercialEtiquetaInput,
} from "@/lib/types/commercial-etiquetas"

type EtiquetaRow = {
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

function mapError(error: { code?: string; message: string }): RepoError {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

function mapRow(row: EtiquetaRow): CommercialEtiqueta {
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

/** Loose client: table lands via migration ahead of generated Database types. */
export type CommercialEtiquetasClient = SupabaseClient

export async function listCommercialEtiquetas(
  client: CommercialEtiquetasClient,
  companyId: string,
  options?: { activeOnly?: boolean }
): Promise<RepoResult<CommercialEtiqueta[]>> {
  let query = client
    .from("commercial_etiquetas" as never)
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
    data: ((data ?? []) as EtiquetaRow[]).map(mapRow),
    error: null,
  }
}

export async function createCommercialEtiqueta(
  client: CommercialEtiquetasClient,
  companyId: string,
  input: CreateCommercialEtiquetaInput
): Promise<RepoResult<CommercialEtiqueta>> {
  const name = input.name.trim()
  if (!name) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Ingrese el nombre de la etiqueta." },
    }
  }

  const { data: existing } = await client
    .from("commercial_etiquetas" as never)
    .select("sort_order")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)

  const maxOrder = Array.isArray(existing) && existing[0]
    ? Number((existing[0] as { sort_order: number }).sort_order) || 0
    : 0

  const { data, error } = await client
    .from("commercial_etiquetas" as never)
    .insert({
      company_id: companyId,
      name,
      color: (input.color?.trim() || "#64748b").trim(),
      sort_order: input.sortOrder ?? maxOrder + 1,
      is_active: input.isActive ?? true,
    } as never)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo crear la etiqueta." }),
    }
  }

  return { data: mapRow(data as EtiquetaRow), error: null }
}

export async function updateCommercialEtiqueta(
  client: CommercialEtiquetasClient,
  companyId: string,
  id: string,
  input: UpdateCommercialEtiquetaInput
): Promise<RepoResult<CommercialEtiqueta>> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.color !== undefined) patch.color = input.color.trim() || "#64748b"
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder
  if (input.isActive !== undefined) patch.is_active = input.isActive

  const { data, error } = await client
    .from("commercial_etiquetas" as never)
    .update(patch as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo actualizar la etiqueta." }),
    }
  }

  return { data: mapRow(data as EtiquetaRow), error: null }
}

export async function softDeleteCommercialEtiqueta(
  client: CommercialEtiquetasClient,
  companyId: string,
  id: string
): Promise<RepoResult<true>> {
  const { error } = await client
    .from("commercial_etiquetas" as never)
    .update({ deleted_at: new Date().toISOString(), is_active: false } as never)
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: true, error: null }
}
