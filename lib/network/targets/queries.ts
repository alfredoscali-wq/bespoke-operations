import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { mapNetworkTargetRow } from "@/lib/network/mapper"
import { encryptNetworkDeviceSecret } from "@/lib/network/secrets"
import type {
  NetworkDiscoveryTarget,
  NetworkDiscoveryTargetDraft,
} from "@/lib/network/types"

type Client = SupabaseClient<Database>
type TargetRow = Database["public"]["Tables"]["network_discovery_targets"]["Row"]

const TARGET_PUBLIC_COLUMNS =
  "id, company_id, agent_id, site_id, name, vendor, host, port, protocol, created_at, updated_at, deleted_at, secret_ciphertext" as const

export async function listNetworkDiscoveryTargets(
  client: Client,
  companyId: string
): Promise<NetworkDiscoveryTarget[]> {
  const { data, error } = await client
    .from("network_discovery_targets")
    .select(
      `${TARGET_PUBLIC_COLUMNS}, network_agents ( name ), network_sites ( name )`
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const agent = row.network_agents as { name: string } | null
    const site = row.network_sites as { name: string } | null
    return mapNetworkTargetRow(row, {
      agentName: agent?.name ?? null,
      siteName: site?.name ?? null,
    })
  })
}

export async function getNetworkDiscoveryTarget(
  client: Client,
  companyId: string,
  targetId: string
): Promise<NetworkDiscoveryTarget | null> {
  const { data, error } = await client
    .from("network_discovery_targets")
    .select(
      `${TARGET_PUBLIC_COLUMNS}, network_agents ( name ), network_sites ( name )`
    )
    .eq("company_id", companyId)
    .eq("id", targetId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) return null

  const agent = data.network_agents as { name: string } | null
  const site = data.network_sites as { name: string } | null
  return mapNetworkTargetRow(data, {
    agentName: agent?.name ?? null,
    siteName: site?.name ?? null,
  })
}

export async function insertNetworkDiscoveryTarget(
  client: Client,
  companyId: string,
  draft: NetworkDiscoveryTargetDraft
): Promise<NetworkDiscoveryTarget> {
  const secret = encryptNetworkDeviceSecret(draft.password)
  const { data, error } = await client
    .from("network_discovery_targets")
    .insert({
      company_id: companyId,
      agent_id: draft.agentId,
      site_id: draft.siteId,
      name: draft.name,
      vendor: draft.vendor,
      host: draft.host,
      port: draft.port ?? (draft.protocol === "rest" ? 443 : 8728),
      protocol: draft.protocol,
      username: draft.username,
      secret_ciphertext: secret.ciphertext,
      secret_iv: secret.iv,
      secret_tag: secret.tag,
    })
    .select(TARGET_PUBLIC_COLUMNS)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar el destino.")
  }

  return mapNetworkTargetRow(data)
}

export async function getNetworkDiscoveryTargetSecretRow(
  client: Client,
  companyId: string,
  targetId: string
): Promise<TargetRow | null> {
  const { data, error } = await client
    .from("network_discovery_targets")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", targetId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
