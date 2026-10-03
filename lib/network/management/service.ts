import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { getNetworkAgent } from "@/lib/network/agents/queries"
import { DISCOVERY_EXECUTABLE_JOB_TYPE } from "@/lib/network/discovery/contract"
import { validateNetworkDiscoveryTargetDraft } from "@/lib/network/integrity"
import { createPendingNetworkAgentJob } from "@/lib/network/jobs/queries"
import { getNetworkManagementConnector } from "@/lib/network/management/connector"
import {
  DIAGNOSTIC_EXECUTABLE_JOB_TYPE,
  resolveNetworkManagementVendor,
  selectManagementAccessOption,
} from "@/lib/network/management/vendor"
import { stripNetworkSecrets } from "@/lib/network/secrets"
import { upsertNetworkDiscoveryTarget } from "@/lib/network/targets/queries"
import type { NetworkAgentJob, NetworkDiscoveryTarget } from "@/lib/network/types"

type Client = SupabaseClient<Database>

export type AdministerObservedDeviceInput = {
  deviceId: string
  agentId?: string | null
  protocol?: unknown
  port?: unknown
  username?: unknown
  password?: unknown
  intent: "test" | "discover"
}

export type AdministerObservedDeviceResult = {
  target: NetworkDiscoveryTarget
  job: NetworkAgentJob
  managed: true
}

function mapAgentUnavailable(status: string | null | undefined): string | null {
  if (status === "offline" || status === "pending") {
    return "El Agent no está disponible."
  }
  return null
}

export async function administerObservedNetworkDevice(
  client: Client,
  companyId: string,
  input: AdministerObservedDeviceInput
): Promise<
  | { ok: true; result: AdministerObservedDeviceResult }
  | { ok: false; status: number; message: string }
> {
  const { data: device, error: deviceError } = await client
    .from("network_devices")
    .select(
      "id, company_id, agent_id, site_id, hostname, manufacturer, model, firmware_version, management_ip"
    )
    .eq("company_id", companyId)
    .eq("id", input.deviceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (deviceError) throw new Error(deviceError.message)
  if (!device) {
    return { ok: false, status: 404, message: "Dispositivo no encontrado." }
  }

  const host = device.management_ip?.trim() ?? ""
  if (!host) {
    return {
      ok: false,
      status: 400,
      message: "El dispositivo no tiene IP de gestión para administrarlo.",
    }
  }

  const vendor = resolveNetworkManagementVendor({
    manufacturer: device.manufacturer,
    platform: device.manufacturer,
    board: device.model,
  })
  if (!vendor) {
    return {
      ok: false,
      status: 400,
      message: "No hay suficiente información de fabricante para administrar este dispositivo.",
    }
  }

  const connector = getNetworkManagementConnector(vendor)
  if ("error" in connector) {
    return { ok: false, status: 400, message: connector.error }
  }

  const agentId = (input.agentId?.trim() || device.agent_id || "").trim()
  if (!agentId) {
    return {
      ok: false,
      status: 400,
      message: "El dispositivo no tiene un Network Agent asociado.",
    }
  }

  const agent = await getNetworkAgent(client, companyId, agentId)
  if (!agent) {
    return { ok: false, status: 404, message: "Agent no encontrado." }
  }
  const agentMessage = mapAgentUnavailable(agent.status)
  if (agentMessage) {
    return { ok: false, status: 409, message: agentMessage }
  }

  const parsed = validateNetworkDiscoveryTargetDraft({
    agentId: agent.id,
    siteId: device.site_id,
    name: device.hostname?.trim() || host,
    vendor,
    host,
    protocol: input.protocol,
    port: input.port,
    username: input.username,
    password: input.password,
  })
  if (!parsed.ok) {
    return { ok: false, status: 400, message: parsed.message }
  }

  const access = selectManagementAccessOption(
    connector.profile,
    parsed.draft.protocol,
    parsed.draft.port ?? (parsed.draft.protocol === "rest" ? 443 : 8728)
  )
  if (!access) {
    return {
      ok: false,
      status: 400,
      message: "El protocolo o puerto no corresponde a este fabricante.",
    }
  }

  const target = await upsertNetworkDiscoveryTarget(client, companyId, {
    ...parsed.draft,
    protocol: access.protocol,
    port: access.port,
  })

  const jobType =
    input.intent === "test"
      ? DIAGNOSTIC_EXECUTABLE_JOB_TYPE
      : DISCOVERY_EXECUTABLE_JOB_TYPE

  const job = await createPendingNetworkAgentJob(client, {
    companyId,
    agentId: agent.id,
    siteId: target.siteId,
    jobType,
    payload: {
      targetId: target.id,
      vendor: target.vendor,
      host: target.host,
      siteId: target.siteId,
      targetName: target.name,
      deviceId: device.id,
    },
  })

  return {
    ok: true,
    result: {
      target: stripNetworkSecrets(target) as NetworkDiscoveryTarget,
      job: stripNetworkSecrets(job) as NetworkAgentJob,
      managed: true,
    },
  }
}
