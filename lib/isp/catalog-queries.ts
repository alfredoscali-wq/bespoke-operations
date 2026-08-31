import type { SupabaseClient } from "@supabase/supabase-js"

import {
  assertTechnicalProfileForCatalog,
  assertTvPlanForCatalog,
  canPhysicallyDeleteCatalogItem,
  mapCatalogWriteError,
  matchesCatalogFilters,
  resolvedTvPlanCatalogId,
  validateCatalogDraft,
} from "@/lib/isp/catalog-integrity"
import {
  mapCatalogDraftToInsert,
  mapIspCatalogRow,
  mapIspCatalogTvPlanRow,
} from "@/lib/isp/catalog-mapper"
import type {
  IspCatalogDraft,
  IspCatalogItem,
  IspCatalogListFilters,
  IspCatalogTvPlan,
  IspTechnicalProfile,
} from "@/lib/isp/catalog-types"
import type { Database } from "@/lib/supabase/database.types"
import {
  createIspTechnicalProfile,
  getIspTechnicalProfile,
  getIspTechnicalProfilesByIds,
} from "@/lib/isp/technical-profile-queries"

export type IspCatalogQueriesClient = SupabaseClient<Database>

async function countCatalogUsage(
  client: IspCatalogQueriesClient,
  companyId: string,
  catalogIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (catalogIds.length === 0) return counts

  const [{ data: services }, { data: tasks }] = await Promise.all([
    client
      .from("isp_services")
      .select("catalog_id")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("catalog_id", catalogIds),
    client
      .from("tasks")
      .select("service_catalog_id")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("service_catalog_id", catalogIds),
  ])

  for (const row of services ?? []) {
    const id = row.catalog_id
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  for (const row of tasks ?? []) {
    const id = row.service_catalog_id
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

async function attachTechnicalProfiles(
  client: IspCatalogQueriesClient,
  companyId: string,
  items: IspCatalogItem[]
): Promise<IspCatalogItem[]> {
  const ids = items
    .map((item) => item.technicalProfileId)
    .filter((id): id is string => Boolean(id))
  const profiles = await getIspTechnicalProfilesByIds(client, companyId, ids)
  return items.map((item) => ({
    ...item,
    technicalProfile: item.technicalProfileId
      ? (profiles.get(item.technicalProfileId) ?? null)
      : null,
  }))
}

type TvPlanLookup = IspCatalogTvPlan & { category: string }

async function attachTvPlans(
  client: IspCatalogQueriesClient,
  companyId: string,
  items: IspCatalogItem[]
): Promise<IspCatalogItem[]> {
  const ids = [
    ...new Set(
      items
        .map((item) => item.tvPlanCatalogId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  if (ids.length === 0) return items

  const { data, error } = await client
    .from("isp_service_catalog")
    .select("id, company_id, code, name, monthly_price, is_active, category")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in("id", ids)

  if (error) throw new Error(error.message)

  const plans = new Map(
    (data ?? []).map((row) => [row.id, mapIspCatalogTvPlanRow(row)])
  )
  return items.map((item) => ({
    ...item,
    tvPlan: item.tvPlanCatalogId
      ? (plans.get(item.tvPlanCatalogId) ?? null)
      : null,
  }))
}

async function hydrateCatalogItems(
  client: IspCatalogQueriesClient,
  companyId: string,
  items: IspCatalogItem[]
): Promise<IspCatalogItem[]> {
  return attachTvPlans(
    client,
    companyId,
    await attachTechnicalProfiles(client, companyId, items)
  )
}

async function resolveTvPlanForCatalog(
  client: IspCatalogQueriesClient,
  companyId: string,
  draft: IspCatalogDraft,
  options: {
    catalogId?: string | null
    currentlyLinkedTvPlanId?: string | null
  } = {}
): Promise<{ id: string | null; plan: IspCatalogTvPlan | null }> {
  const selected = resolvedTvPlanCatalogId(draft)
  if (!selected) return { id: null, plan: null }

  const { data, error } = await client
    .from("isp_service_catalog")
    .select("id, company_id, code, name, monthly_price, is_active, category")
    .eq("company_id", companyId)
    .eq("id", selected)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const tvPlan: TvPlanLookup | null = data
    ? { ...mapIspCatalogTvPlanRow(data), category: data.category }
    : null

  const check = assertTvPlanForCatalog({
    companyId,
    catalogId: options.catalogId,
    selectedTvPlanId: selected,
    tvPlan,
    currentlyLinkedTvPlanId: options.currentlyLinkedTvPlanId,
  })
  if (!check.ok) {
    throw new Error(check.message)
  }
  return { id: selected, plan: tvPlan }
}

async function persistLinkedProfileSpeeds(
  client: IspCatalogQueriesClient,
  companyId: string,
  profileId: string | null,
  speeds: {
    download: number | null
    upload: number | null
    unit: string
  }
) {
  if (!profileId) return

  const { error } = await client
    .from("isp_technical_profiles")
    .update({
      download_speed: speeds.download,
      upload_speed: speeds.upload,
      speed_unit: speeds.unit,
    })
    .eq("company_id", companyId)
    .eq("id", profileId)
    .is("deleted_at", null)

  if (error) throw new Error(mapCatalogWriteError(error))
}

function profileWithCatalogSpeeds(
  profile: IspTechnicalProfile | null,
  speeds: {
    download: number | null
    upload: number | null
    unit: string
  }
): IspTechnicalProfile | null {
  if (!profile) return null
  return {
    ...profile,
    downloadSpeed: speeds.download,
    uploadSpeed: speeds.upload,
    speedUnit: speeds.unit,
  }
}

async function resolveTechnicalProfileId(
  client: IspCatalogQueriesClient,
  companyId: string,
  draft: IspCatalogDraft,
  currentlyLinkedProfileId?: string | null
): Promise<{ id: string | null; profile: IspTechnicalProfile | null }> {
  if (draft.createTechnicalProfile) {
    const created = await createIspTechnicalProfile(
      client,
      companyId,
      draft.technicalProfile
    )
    return { id: created.id, profile: created }
  }

  const selected = draft.technicalProfileId.trim()
  if (!selected) return { id: null, profile: null }

  const profile = await getIspTechnicalProfile(client, companyId, selected)
  const check = assertTechnicalProfileForCatalog({
    companyId,
    selectedProfileId: selected,
    profile,
    currentlyLinkedProfileId,
  })
  if (!check.ok) {
    throw new Error(check.message)
  }
  return { id: selected, profile }
}

export async function listIspCatalog(
  client: IspCatalogQueriesClient,
  companyId: string,
  filters: IspCatalogListFilters = {}
): Promise<IspCatalogItem[]> {
  const { data, error } = await client
    .from("isp_service_catalog")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) throw new Error(error.message)

  const ids = (data ?? []).map((row) => row.id)
  const usage = await countCatalogUsage(client, companyId, ids)
  const mapped = (data ?? []).map((row) =>
    mapIspCatalogRow(row, usage.get(row.id) ?? 0)
  )
  const hydrated = await hydrateCatalogItems(client, companyId, mapped)
  return hydrated.filter((item) => matchesCatalogFilters(item, filters))
}

export async function getIspCatalogItem(
  client: IspCatalogQueriesClient,
  companyId: string,
  id: string
): Promise<IspCatalogItem | null> {
  const { data, error } = await client
    .from("isp_service_catalog")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const usage = await countCatalogUsage(client, companyId, [id])
  const [item] = await hydrateCatalogItems(client, companyId, [
    mapIspCatalogRow(data, usage.get(id) ?? 0),
  ])
  return item ?? null
}

export async function listIspCatalogForOt(
  client: IspCatalogQueriesClient,
  companyId: string,
  includeId?: string | null
): Promise<IspCatalogItem[]> {
  let query = client
    .from("isp_service_catalog")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (includeId) {
    query = query.or(`is_active.eq.true,id.eq.${includeId}`)
  } else {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query.order("download_speed_mbps", {
    ascending: true,
    nullsFirst: false,
  })

  if (error) throw new Error(error.message)
  return hydrateCatalogItems(
    client,
    companyId,
    (data ?? []).map((row) => mapIspCatalogRow(row))
  )
}

export async function createIspCatalogItem(
  client: IspCatalogQueriesClient,
  companyId: string,
  draft: IspCatalogDraft
): Promise<IspCatalogItem> {
  const validation = validateCatalogDraft(draft)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  const resolved = await resolveTechnicalProfileId(client, companyId, draft)
  const tvResolved = await resolveTvPlanForCatalog(client, companyId, draft)
  const insert = mapCatalogDraftToInsert(companyId, draft, resolved.id)
  const speeds = {
    download: insert.download_speed_mbps ?? null,
    upload: insert.upload_speed_mbps ?? null,
    unit: insert.speed_unit || "mbps",
  }

  const { data, error } = await client
    .from("isp_service_catalog")
    .insert(insert)
    .select("*")
    .single()

  if (error) throw new Error(mapCatalogWriteError(error))
  await persistLinkedProfileSpeeds(client, companyId, resolved.id, speeds)
  return mapIspCatalogRow(
    data,
    0,
    profileWithCatalogSpeeds(resolved.profile, speeds),
    tvResolved.plan
  )
}

export async function updateIspCatalogItem(
  client: IspCatalogQueriesClient,
  companyId: string,
  id: string,
  draft: IspCatalogDraft
): Promise<IspCatalogItem> {
  const validation = validateCatalogDraft(draft)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  const current = await getIspCatalogItem(client, companyId, id)
  if (!current) throw new Error("Servicio no encontrado.")

  const resolved = await resolveTechnicalProfileId(
    client,
    companyId,
    draft,
    current.technicalProfileId
  )
  const tvResolved = await resolveTvPlanForCatalog(client, companyId, draft, {
    catalogId: id,
    currentlyLinkedTvPlanId: current.tvPlanCatalogId,
  })
  const insert = mapCatalogDraftToInsert(companyId, draft, resolved.id)
  const speeds = {
    download: insert.download_speed_mbps ?? null,
    upload: insert.upload_speed_mbps ?? null,
    unit: insert.speed_unit || "mbps",
  }
  const { data, error } = await client
    .from("isp_service_catalog")
    .update({
      code: insert.code,
      name: insert.name,
      category: insert.category,
      customer_type: insert.customer_type,
      description: insert.description,
      is_active: insert.is_active,
      technology: insert.technology,
      download_speed_mbps: insert.download_speed_mbps,
      upload_speed_mbps: insert.upload_speed_mbps,
      speed_unit: insert.speed_unit,
      monthly_price: insert.monthly_price,
      currency: insert.currency,
      price_is_configurable: insert.price_is_configurable,
      billing_period: insert.billing_period,
      billing_method: insert.billing_method,
      requires_connection: insert.requires_connection,
      allowed_connection_types: insert.allowed_connection_types,
      technical_profile_id: insert.technical_profile_id,
      tv_plan_catalog_id: insert.tv_plan_catalog_id,
      ot_label: insert.ot_label,
    })
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error) throw new Error(mapCatalogWriteError(error))
  await persistLinkedProfileSpeeds(client, companyId, resolved.id, speeds)
  const usage = await countCatalogUsage(client, companyId, [id])
  return mapIspCatalogRow(
    data,
    usage.get(id) ?? 0,
    profileWithCatalogSpeeds(resolved.profile, speeds),
    tvResolved.plan
  )
}

export async function setIspCatalogActive(
  client: IspCatalogQueriesClient,
  companyId: string,
  id: string,
  isActive: boolean
): Promise<IspCatalogItem> {
  const { data, error } = await client
    .from("isp_service_catalog")
    .update({ is_active: isActive })
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const usage = await countCatalogUsage(client, companyId, [id])
  const [item] = await hydrateCatalogItems(client, companyId, [
    mapIspCatalogRow(data, usage.get(id) ?? 0),
  ])
  if (!item) throw new Error("Servicio no encontrado.")
  return item
}

export async function deactivateIspCatalogItem(
  client: IspCatalogQueriesClient,
  companyId: string,
  id: string
): Promise<IspCatalogItem> {
  const current = await getIspCatalogItem(client, companyId, id)
  if (!current) throw new Error("Servicio no encontrado.")
  const deletion = canPhysicallyDeleteCatalogItem({
    usedCount: current.usedCount ?? 0,
  })
  if (!deletion.allowed) {
    return setIspCatalogActive(client, companyId, id, false)
  }
  return setIspCatalogActive(client, companyId, id, false)
}
