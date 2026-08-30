import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { NETWORK_AGENT_STATUSES } from "@/lib/network/constants"
import { selectManagedNetworkDevices } from "@/lib/network/devices/managed"
import { countNetworkMonitoringSummary } from "@/lib/network/monitoring/queries"
import { mapNetworkAgentRow } from "@/lib/network/mapper"
import type { NetworkAgent, NetworkHomeSummary } from "@/lib/network/types"

type Client = SupabaseClient<Database>
type NetworkAgentRow = Database["public"]["Tables"]["network_agents"]["Row"]

function emptyStatusCounts(): NetworkHomeSummary["agentsByStatus"] {
  return {
    pending: 0,
    online: 0,
    degraded: 0,
    offline: 0,
    maintenance: 0,
  }
}

export async function listNetworkAgents(
  client: Client,
  companyId: string
): Promise<NetworkAgent[]> {
  const { data, error } = await client
    .from("network_agents")
    .select("*, network_sites!network_agents_site_id_fkey ( name, deleted_at )")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const site = row.network_sites as
      | { name: string; deleted_at: string | null }
      | null
    return mapNetworkAgentRow(row, site?.name ?? null)
  })
}

export async function getNetworkAgent(
  client: Client,
  companyId: string,
  agentId: string
): Promise<NetworkAgent | null> {
  const { data, error } = await client
    .from("network_agents")
    .select("*, network_sites!network_agents_site_id_fkey ( name )")
    .eq("company_id", companyId)
    .eq("id", agentId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) return null

  const site = data.network_sites as { name: string } | null
  return mapNetworkAgentRow(data, site?.name ?? null)
}

export async function insertPendingNetworkAgent(
  client: Client,
  input: {
    companyId: string
    siteId: string | null
    name: string
    enrollmentTokenHash: string
    enrollmentExpiresAt: string
  }
): Promise<NetworkAgentRow> {
  const { data, error } = await client
    .from("network_agents")
    .insert({
      company_id: input.companyId,
      site_id: input.siteId,
      name: input.name,
      status: "pending",
      enrollment_token_hash: input.enrollmentTokenHash,
      enrollment_expires_at: input.enrollmentExpiresAt,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar el agent.")
  }

  return data
}

export async function findNetworkAgentByEnrollmentHash(
  client: Client,
  tokenHash: string
): Promise<NetworkAgentRow | null> {
  const { data, error } = await client
    .from("network_agents")
    .select("*")
    .eq("enrollment_token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function findNetworkAgentByCredentialHash(
  client: Client,
  tokenHash: string
): Promise<NetworkAgentRow | null> {
  const { data, error } = await client
    .from("network_agents")
    .select("*")
    .eq("credential_token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function completeNetworkAgentEnrollment(
  client: Client,
  agentId: string,
  companyId: string,
  input: {
    credentialTokenHash: string
    version: string | null
    hostname: string | null
  }
): Promise<NetworkAgentRow> {
  const { data, error } = await client
    .from("network_agents")
    .update({
      credential_token_hash: input.credentialTokenHash,
      enrollment_token_hash: null,
      enrollment_expires_at: null,
      enrolled_at: new Date().toISOString(),
      version: input.version,
      hostname: input.hostname,
    })
    .eq("id", agentId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo completar el enrollment.")
  }

  return data
}

export async function applyNetworkAgentHeartbeat(
  client: Client,
  agentId: string,
  companyId: string,
  input: {
    status: NetworkAgentRow["status"]
    version: string | null
    hostname: string | null
    lastSeenAt: string
  }
): Promise<NetworkAgentRow> {
  const { data, error } = await client
    .from("network_agents")
    .update({
      status: input.status,
      version: input.version,
      hostname: input.hostname,
      last_seen_at: input.lastSeenAt,
    })
    .eq("id", agentId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar el heartbeat.")
  }

  return data
}

export async function getNetworkHomeSummary(
  client: Client,
  companyId: string
): Promise<NetworkHomeSummary> {
  const [sites, agents, jobs, devices, targets] = await Promise.all([
    client
      .from("network_sites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("network_agents")
      .select("status")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("network_agent_jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending")
      .is("deleted_at", null),
    client
      .from("network_devices")
      .select("id, company_id, agent_id, management_ip")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("network_discovery_targets")
      .select("company_id, agent_id, host")
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ])

  if (sites.error) throw new Error(sites.error.message)
  if (agents.error) throw new Error(agents.error.message)
  if (jobs.error) throw new Error(jobs.error.message)
  if (devices.error) throw new Error(devices.error.message)
  if (targets.error) throw new Error(targets.error.message)

  const agentsByStatus = emptyStatusCounts()
  for (const row of agents.data ?? []) {
    if (NETWORK_AGENT_STATUSES.includes(row.status as (typeof NETWORK_AGENT_STATUSES)[number])) {
      agentsByStatus[row.status as keyof typeof agentsByStatus] += 1
    }
  }

  const managed = selectManagedNetworkDevices(
    (devices.data ?? []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      agentId: row.agent_id,
      managementIp: row.management_ip,
    })),
    (targets.data ?? []).map((row) => ({
      companyId: row.company_id,
      agentId: row.agent_id,
      host: row.host,
    }))
  )
  const managedDeviceIds = new Set(managed.map((device) => device.id))
  const monitoring = await countNetworkMonitoringSummary(
    client,
    companyId,
    managedDeviceIds
  )

  return {
    siteCount: sites.count ?? 0,
    agentCount: (agents.data ?? []).length,
    deviceCount: managed.length,
    agentsByStatus,
    pendingJobCount: jobs.count ?? 0,
    ...monitoring,
  }
}
