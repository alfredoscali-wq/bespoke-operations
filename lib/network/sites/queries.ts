import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { mapNetworkSiteRow } from "@/lib/network/mapper"
import type { NetworkSite, NetworkSiteDraft } from "@/lib/network/types"

type Client = SupabaseClient<Database>

export async function listNetworkSites(
  client: Client,
  companyId: string
): Promise<NetworkSite[]> {
  const [{ data: sites, error: sitesError }, { data: agents, error: agentsError }] =
    await Promise.all([
      client
        .from("network_sites")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      client
        .from("network_agents")
        .select("id, site_id")
        .eq("company_id", companyId)
        .is("deleted_at", null),
    ])

  if (sitesError) {
    throw new Error(sitesError.message)
  }
  if (agentsError) {
    throw new Error(agentsError.message)
  }

  const countBySite = new Map<string, number>()
  for (const agent of agents ?? []) {
    if (!agent.site_id) continue
    countBySite.set(agent.site_id, (countBySite.get(agent.site_id) ?? 0) + 1)
  }

  return (sites ?? []).map((row) =>
    mapNetworkSiteRow(row, countBySite.get(row.id) ?? 0)
  )
}

export async function getNetworkSite(
  client: Client,
  companyId: string,
  siteId: string
): Promise<NetworkSite | null> {
  const { data, error } = await client
    .from("network_sites")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", siteId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) return null

  const { count, error: countError } = await client
    .from("network_agents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .is("deleted_at", null)

  if (countError) {
    throw new Error(countError.message)
  }

  return mapNetworkSiteRow(data, count ?? 0)
}

export async function createNetworkSite(
  client: Client,
  companyId: string,
  draft: NetworkSiteDraft
): Promise<NetworkSite> {
  const { data, error } = await client
    .from("network_sites")
    .insert({
      company_id: companyId,
      name: draft.name,
      kind: draft.kind,
      description: draft.description ?? null,
      address: draft.address ?? null,
      locality: draft.locality ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el sitio.")
  }

  return mapNetworkSiteRow(data, 0)
}
