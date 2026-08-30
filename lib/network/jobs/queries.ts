import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"
import { mapNetworkJobRow } from "@/lib/network/mapper"
import type { NetworkJobType } from "@/lib/network/constants"
import type { NetworkAgentJob, NetworkDiscoveryJobView } from "@/lib/network/types"

type Client = SupabaseClient<Database>
type JobRow = Database["public"]["Tables"]["network_agent_jobs"]["Row"]

export async function listNetworkAgentJobs(
  client: Client,
  companyId: string,
  agentId: string
): Promise<NetworkAgentJob[]> {
  const { data, error } = await client
    .from("network_agent_jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("agent_id", agentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => mapNetworkJobRow(row))
}

export async function listNetworkDiscoveryJobs(
  client: Client,
  companyId: string
): Promise<NetworkDiscoveryJobView[]> {
  const { data, error } = await client
    .from("network_agent_jobs")
    .select("*, network_agents ( name )")
    .eq("company_id", companyId)
    .eq("job_type", "discovery")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const agent = row.network_agents as { name: string } | null
    const job = mapNetworkJobRow(row, agent?.name ?? null)
    const targetName =
      typeof job.payload.targetName === "string" ? job.payload.targetName : null
    const targetHost =
      typeof job.payload.host === "string" ? job.payload.host : null
    return {
      ...job,
      targetName,
      targetHost,
    }
  })
}

export async function createPendingNetworkAgentJob(
  client: Client,
  input: {
    companyId: string
    agentId: string
    siteId: string | null
    jobType: NetworkJobType
    payload?: Record<string, unknown>
  }
): Promise<NetworkAgentJob> {
  const { data, error } = await client
    .from("network_agent_jobs")
    .insert({
      company_id: input.companyId,
      agent_id: input.agentId,
      site_id: input.siteId,
      job_type: input.jobType,
      status: "pending",
      payload: (input.payload ?? {}) as Json,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el job.")
  }

  return mapNetworkJobRow(data)
}

export async function getNetworkAgentJob(
  client: Client,
  companyId: string,
  jobId: string
): Promise<JobRow | null> {
  const { data, error } = await client
    .from("network_agent_jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", jobId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function claimNextPendingNetworkAgentJob(
  client: Client,
  input: { companyId: string; agentId: string }
): Promise<JobRow | null> {
  const { data: pending, error: pendingError } = await client
    .from("network_agent_jobs")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .in("job_type", ["discovery", "monitoring"])
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (pendingError) {
    throw new Error(pendingError.message)
  }
  if (!pending) return null

  const now = new Date().toISOString()
  const { data: claimed, error: claimError } = await client
    .from("network_agent_jobs")
    .update({
      status: "dispatched",
      dispatched_at: now,
    })
    .eq("id", pending.id)
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (claimError) {
    throw new Error(claimError.message)
  }

  return claimed
}

export async function markNetworkAgentJobRunning(
  client: Client,
  input: { companyId: string; agentId: string; jobId: string }
): Promise<JobRow> {
  const now = new Date().toISOString()
  const { data, error } = await client
    .from("network_agent_jobs")
    .update({
      status: "running",
      started_at: now,
    })
    .eq("id", input.jobId)
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .in("status", ["dispatched", "pending"])
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error("El job no está disponible para ejecutar.")
  }

  return data
}

export async function completeNetworkAgentJob(
  client: Client,
  input: {
    companyId: string
    agentId: string
    jobId: string
    status: "completed" | "failed"
    result: Record<string, unknown> | null
    errorMessage: string | null
  }
): Promise<JobRow> {
  const now = new Date().toISOString()
  const { data, error } = await client
    .from("network_agent_jobs")
    .update({
      status: input.status,
      result: (input.result ?? null) as Json | null,
      error_message: input.errorMessage,
          completed_at: now,
        })
    .eq("id", input.jobId)
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .in("status", ["pending", "dispatched", "running"])
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error("El job no está disponible para completar.")
  }

  return data
}
