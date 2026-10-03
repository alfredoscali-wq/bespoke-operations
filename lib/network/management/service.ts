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
import {
  findNetworkDiscoveryTargetByAgentHost,
  upsertNetworkDiscoveryTarget,
} from "@/lib/network/targets/queries"
import type { NetworkAgentJob, NetworkDiscoveryTarget } from "@/lib/network/types"

type Client = SupabaseClient<Database>

export type AdministerObservedDeviceIntent = "test" | "discover" | "replace"

export type AdministerObservedDeviceInput = {
  deviceId: string
  agentId?: string | null
  protocol?: unknown
  port?: unknown
  username?: unknown
  password?: unknown
  intent: AdministerObservedDeviceIntent
}

export type AdministerObservedDeviceResult = {
  target: NetworkDiscoveryTarget
  job: NetworkAgentJob | null
  managed: true
}

function mapAgentUnavailable(status: string | null | undefined): string | null {
  if (status === "offline" || status === "pending") {
    return "El Agent no está disponible."
  }
  return null
}

async function enqueueTargetJob(
  client: Client,
  input: {
    companyId: string
    agentId: string
    deviceId: string
    target: NetworkDiscoveryTarget
    jobType: typeof DIAGNOSTIC_EXECUTABLE_JOB_TYPE | typeof DISCOVERY_EXECUTABLE_JOB_TYPE
  }
): Promise<NetworkAgentJob> {
  return createPendingNetworkAgentJob(client, {
    companyId: input.companyId,
    agentId: input.agentId,
    siteId: input.target.siteId,
    jobType: input.jobType,
    payload: {
      targetId: input.target.id,
      vendor: input.target.vendor,
      host: input.target.host,
      siteId: input.target.siteId,
      targetName: input.target.name,
      deviceId: input.deviceId,
    },
  })
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

  const requestedAgentId = (input.agentId?.trim() || device.agent_id || "").trim()
  if (!requestedAgentId) {
    return {
      ok: false,
      status: 400,
      message: "El dispositivo no tiene un Network Agent asociado.",
    }
  }

  const existingByDeviceAgent = device.agent_id
    ? await findNetworkDiscoveryTargetByAgentHost(
        client,
        companyId,
        device.agent_id,
        host
      )
    : null
  const existingTarget =
    existingByDeviceAgent ??
    (await findNetworkDiscoveryTargetByAgentHost(
      client,
      companyId,
      requestedAgentId,
      host
    ))

  const lockedAgentId =
    input.intent === "replace" || existingTarget
      ? existingTarget?.agentId ?? device.agent_id ?? requestedAgentId
      : requestedAgentId

  const agent = await getNetworkAgent(client, companyId, lockedAgentId)
  if (!agent) {
    return { ok: false, status: 404, message: "Agent no encontrado." }
  }
  const agentMessage = mapAgentUnavailable(agent.status)
  if (agentMessage) {
    return { ok: false, status: 409, message: agentMessage }
  }

  const password =
    typeof input.password === "string" ? input.password : ""

  if (
    (input.intent === "test" || input.intent === "discover") &&
    !password.trim()
  ) {
    if (!existingTarget?.hasSecret) {
      return {
        ok: false,
        status: 400,
        message:
          input.intent === "discover"
            ? "Probá la conexión antes de descubrir."
            : "Reemplazá las credenciales antes de probar.",
      }
    }
    const job = await enqueueTargetJob(client, {
      companyId,
      agentId: existingTarget.agentId,
      deviceId: device.id,
      target: existingTarget,
      jobType:
        input.intent === "test"
          ? DIAGNOSTIC_EXECUTABLE_JOB_TYPE
          : DISCOVERY_EXECUTABLE_JOB_TYPE,
    })
    return {
      ok: true,
      result: {
        target: stripNetworkSecrets(existingTarget) as NetworkDiscoveryTarget,
        job: stripNetworkSecrets(job) as NetworkAgentJob,
        managed: true,
      },
    }
  }

  if (input.intent === "replace" && !existingTarget) {
    return {
      ok: false,
      status: 400,
      message: "El dispositivo no está administrado.",
    }
  }

  const parsed = validateNetworkDiscoveryTargetDraft({
    agentId: lockedAgentId,
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
    agentId: lockedAgentId,
    host,
    protocol: access.protocol,
    port: access.port,
  })

  if (input.intent === "replace") {
    return {
      ok: true,
      result: {
        target: stripNetworkSecrets(target) as NetworkDiscoveryTarget,
        job: null,
        managed: true,
      },
    }
  }

  const jobType =
    input.intent === "test"
      ? DIAGNOSTIC_EXECUTABLE_JOB_TYPE
      : DISCOVERY_EXECUTABLE_JOB_TYPE

  const job = await enqueueTargetJob(client, {
    companyId,
    agentId: lockedAgentId,
    deviceId: device.id,
    target,
    jobType,
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
