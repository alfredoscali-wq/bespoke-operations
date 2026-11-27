import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"
import { mapNetworkJobRow } from "@/lib/network/mapper"
import {
  NETWORK_JOB_DISPATCHED_STALE_MS,
  NETWORK_JOB_RUNNING_STALE_MS,
  NETWORK_JOB_STALE_DISPATCHED_ERROR,
  NETWORK_JOB_STALE_RUNNING_ERROR,
  type NetworkJobType,
} from "@/lib/network/constants"
import { isNetworkJobType } from "@/lib/network/integrity"
import type {
  NetworkAgentJob,
  NetworkAgentJobListItem,
  NetworkDiscoveryJobView,
} from "@/lib/network/types"

type Client = SupabaseClient<Database>
type JobRow = Database["public"]["Tables"]["network_agent_jobs"]["Row"]

const AGENT_JOB_LIST_COLUMNS =
  "id, company_id, agent_id, site_id, job_type, status, error_message, dispatched_at, started_at, completed_at, created_at, updated_at"

const HISTORY_JOB_LIST_COLUMNS = [
  AGENT_JOB_LIST_COLUMNS,
  "payload_target_id:payload->>targetId",
  "payload_device_id:payload->>deviceId",
  "payload_host:payload->>host",
  "payload_target_name:payload->>targetName",
  "payload_site_id:payload->>siteId",
  "result_target_id:result->>targetId",
  "result_device_count:result->>deviceCount",
  "result_primary_ip:result->>primaryManagementIp",
  "result_host:result->>host",
  "network_agents(name)",
].join(", ")

const HISTORY_JOB_LIMIT = 100

type HistoryJobRow = {
  id: string
  company_id: string
  agent_id: string
  site_id: string | null
  job_type: string
  status: string
  error_message: string | null
  dispatched_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  payload_target_id: string | null
  payload_device_id: string | null
  payload_host: string | null
  payload_target_name: string | null
  payload_site_id: string | null
  result_target_id: string | null
  result_device_count: string | null
  result_primary_ip: string | null
  result_host: string | null
  network_agents: { name: string } | null
}

function listedText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function listedPayload(row: HistoryJobRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const targetId = listedText(row.payload_target_id)
  const deviceId = listedText(row.payload_device_id)
  const host = listedText(row.payload_host)
  const targetName = listedText(row.payload_target_name)
  const siteId = listedText(row.payload_site_id)
  if (targetId) payload.targetId = targetId
  if (deviceId) payload.deviceId = deviceId
  if (host) payload.host = host
  if (targetName) payload.targetName = targetName
  if (siteId) payload.siteId = siteId
  return payload
}

function listedResult(row: HistoryJobRow): Record<string, unknown> | null {
  const targetId = listedText(row.result_target_id)
  const deviceCountText = listedText(row.result_device_count)
  const primaryManagementIp = listedText(row.result_primary_ip)
  const host = listedText(row.result_host)
  const deviceCount = deviceCountText == null ? null : Number(deviceCountText)
  const hasDeviceCount = deviceCount != null && Number.isFinite(deviceCount)
  if (!targetId && !hasDeviceCount && !primaryManagementIp && !host) return null

  const result: Record<string, unknown> = {}
  if (targetId) result.targetId = targetId
  if (hasDeviceCount) result.deviceCount = deviceCount
  if (primaryManagementIp) result.primaryManagementIp = primaryManagementIp
  if (host) result.host = host
  return result
}

function mapHistoryJob(row: HistoryJobRow): NetworkDiscoveryJobView {
  const payload = listedPayload(row)
  const targetName = listedText(row.payload_target_name)
  const targetHost = listedText(row.payload_host)
  return {
    id: row.id,
    companyId: row.company_id,
    agentId: row.agent_id,
    agentName: row.network_agents?.name ?? null,
    siteId: row.site_id,
    jobType: isNetworkJobType(row.job_type) ? row.job_type : "verification",
    status: row.status as NetworkAgentJob["status"],
    payload,
    result: listedResult(row),
    errorMessage: row.error_message,
    dispatchedAt: row.dispatched_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    targetName,
    targetHost,
  }
}

async function listHistoryJobs(
  client: Client,
  companyId: string,
  jobTypes: readonly NetworkJobType[]
): Promise<NetworkDiscoveryJobView[]> {
  const { data, error } = await client
    .from("network_agent_jobs")
    .select(HISTORY_JOB_LIST_COLUMNS)
    .eq("company_id", companyId)
    .in("job_type", [...jobTypes])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(HISTORY_JOB_LIMIT)

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as unknown as HistoryJobRow[]).map(mapHistoryJob)
}

export async function listNetworkAgentJobs(
  client: Client,
  companyId: string,
  agentId: string
): Promise<NetworkAgentJobListItem[]> {
  const { data, error } = await client
    .from("network_agent_jobs")
    .select(AGENT_JOB_LIST_COLUMNS)
    .eq("company_id", companyId)
    .eq("agent_id", agentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    agentId: row.agent_id,
    siteId: row.site_id,
    jobType: isNetworkJobType(row.job_type) ? row.job_type : "verification",
    status: row.status as NetworkAgentJob["status"],
    errorMessage: row.error_message,
    dispatchedAt: row.dispatched_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function listNetworkDiscoveryJobs(
  client: Client,
  companyId: string
): Promise<NetworkDiscoveryJobView[]> {
  return listHistoryJobs(client, companyId, ["discovery"])
}

export async function listNetworkDiagnosticJobs(
  client: Client,
  companyId: string
): Promise<NetworkDiscoveryJobView[]> {
  return listHistoryJobs(client, companyId, ["diagnostic"])
}

export async function listNetworkManagementJobs(
  client: Client,
  companyId: string
): Promise<NetworkDiscoveryJobView[]> {
  return listHistoryJobs(client, companyId, ["discovery", "diagnostic"])
}

export async function listTopologyJobHistory(
  client: Client,
  companyId: string
): Promise<{
  managementJobs: NetworkDiscoveryJobView[]
  discoveryJobs: NetworkDiscoveryJobView[]
}> {
  const [discoveryJobs, managementJobs] = await Promise.all([
    listNetworkDiscoveryJobs(client, companyId),
    listNetworkManagementJobs(client, companyId),
  ])

  return { managementJobs, discoveryJobs }
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

export async function recoverStaleNetworkAgentJobs(
  client: Client,
  input: { companyId: string }
): Promise<{ dispatched: number; running: number }> {
  const now = new Date()
  const nowIso = now.toISOString()
  const dispatchedCutoff = new Date(
    now.getTime() - NETWORK_JOB_DISPATCHED_STALE_MS
  ).toISOString()
  const runningCutoff = new Date(
    now.getTime() - NETWORK_JOB_RUNNING_STALE_MS
  ).toISOString()

  const { data: dispatchedRows, error: dispatchedError } = await client
    .from("network_agent_jobs")
    .update({
      status: "failed",
      error_message: NETWORK_JOB_STALE_DISPATCHED_ERROR,
      completed_at: nowIso,
    })
    .eq("company_id", input.companyId)
    .eq("status", "dispatched")
    .lte("dispatched_at", dispatchedCutoff)
    .is("completed_at", null)
    .is("deleted_at", null)
    .select("id")

  if (dispatchedError) {
    throw new Error(dispatchedError.message)
  }

  const { data: runningRows, error: runningError } = await client
    .from("network_agent_jobs")
    .update({
      status: "failed",
      error_message: NETWORK_JOB_STALE_RUNNING_ERROR,
      completed_at: nowIso,
    })
    .eq("company_id", input.companyId)
    .eq("status", "running")
    .lte("started_at", runningCutoff)
    .is("completed_at", null)
    .is("deleted_at", null)
    .select("id")

  if (runningError) {
    throw new Error(runningError.message)
  }

  const dispatched = dispatchedRows?.length ?? 0
  const running = runningRows?.length ?? 0
  if (dispatched + running > 0) {
    console.info(
      `[Network API] network job recovery: dispatched=${dispatched} running=${running}`
    )
  }

  return { dispatched, running }
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
    .in("job_type", ["discovery", "monitoring", "diagnostic"])
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
