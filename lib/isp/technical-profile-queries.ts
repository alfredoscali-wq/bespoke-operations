import type { SupabaseClient } from "@supabase/supabase-js"

import {
  mapCatalogWriteError,
  validateTechnicalProfileDraft,
} from "@/lib/isp/catalog-integrity"
import {
  mapIspTechnicalProfileRow,
  mapTechnicalProfileDraftToInsert,
} from "@/lib/isp/catalog-mapper"
import type {
  IspTechnicalProfile,
  IspTechnicalProfileDraft,
} from "@/lib/isp/catalog-types"
import type { Database } from "@/lib/supabase/database.types"

export type IspTechnicalProfileQueriesClient = SupabaseClient<Database>

export async function listIspTechnicalProfiles(
  client: IspTechnicalProfileQueriesClient,
  companyId: string,
  options?: { activeOnly?: boolean }
): Promise<IspTechnicalProfile[]> {
  let query = client
    .from("isp_technical_profiles")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("code", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapIspTechnicalProfileRow)
}

export async function getIspTechnicalProfile(
  client: IspTechnicalProfileQueriesClient,
  companyId: string,
  id: string
): Promise<IspTechnicalProfile | null> {
  const { data, error } = await client
    .from("isp_technical_profiles")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapIspTechnicalProfileRow(data) : null
}

export async function getIspTechnicalProfilesByIds(
  client: IspTechnicalProfileQueriesClient,
  companyId: string,
  ids: string[]
): Promise<Map<string, IspTechnicalProfile>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  const result = new Map<string, IspTechnicalProfile>()
  if (uniqueIds.length === 0) return result

  const { data, error } = await client
    .from("isp_technical_profiles")
    .select("*")
    .eq("company_id", companyId)
    .in("id", uniqueIds)
    .is("deleted_at", null)

  if (error) throw new Error(error.message)
  for (const row of data ?? []) {
    const mapped = mapIspTechnicalProfileRow(row)
    result.set(mapped.id, mapped)
  }
  return result
}

export async function createIspTechnicalProfile(
  client: IspTechnicalProfileQueriesClient,
  companyId: string,
  draft: IspTechnicalProfileDraft
): Promise<IspTechnicalProfile> {
  const validation = validateTechnicalProfileDraft(draft)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  const { data, error } = await client
    .from("isp_technical_profiles")
    .insert(mapTechnicalProfileDraftToInsert(companyId, draft))
    .select("*")
    .single()

  if (error) throw new Error(mapCatalogWriteError(error))
  return mapIspTechnicalProfileRow(data)
}

export async function updateIspTechnicalProfile(
  client: IspTechnicalProfileQueriesClient,
  companyId: string,
  id: string,
  draft: IspTechnicalProfileDraft
): Promise<IspTechnicalProfile> {
  const validation = validateTechnicalProfileDraft(draft)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  const insert = mapTechnicalProfileDraftToInsert(companyId, draft)
  const { data, error } = await client
    .from("isp_technical_profiles")
    .update({
      code: insert.code,
      name: insert.name,
      description: insert.description,
      technology: insert.technology,
      connection_type: insert.connection_type,
      download_speed: insert.download_speed,
      upload_speed: insert.upload_speed,
      speed_unit: insert.speed_unit,
      core_name: insert.core_name,
      core_profile_id: insert.core_profile_id,
      is_active: insert.is_active,
    })
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error) throw new Error(mapCatalogWriteError(error))
  return mapIspTechnicalProfileRow(data)
}

export async function setIspTechnicalProfileActive(
  client: IspTechnicalProfileQueriesClient,
  companyId: string,
  id: string,
  isActive: boolean
): Promise<IspTechnicalProfile> {
  const { data, error } = await client
    .from("isp_technical_profiles")
    .update({ is_active: isActive })
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error) throw new Error(mapCatalogWriteError(error))
  return mapIspTechnicalProfileRow(data)
}
