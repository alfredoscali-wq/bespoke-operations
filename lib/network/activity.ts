import "server-only"

import { activity } from "@/lib/activity-engine"
import { ACTIVITY_CATEGORIES, ACTIVITY_IMPACTS, ACTIVITY_ORIGINS } from "@/lib/activity-engine/activity-types"
import {
  NETWORK_ACTIVITY_ENTITY_AGENT,
  NETWORK_ACTIVITY_ENTITY_JOB,
  NETWORK_ACTIVITY_MODULE,
} from "@/lib/network/constants"
import type { NetworkAgentStatus } from "@/lib/network/constants"

export async function recordNetworkAgentEnrolledActivity(input: {
  companyId: string
  agentId: string
  agentName: string
  siteId: string | null
}): Promise<void> {
  const result = await activity.record({
    companyId: input.companyId,
    module: NETWORK_ACTIVITY_MODULE,
    entityType: NETWORK_ACTIVITY_ENTITY_AGENT,
    entityId: input.agentId,
    action: "AGENT_ENROLLED",
    category: ACTIVITY_CATEGORIES.SYSTEM,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.INTEGRATION,
    title: "Network Agent enrolado",
    description: `Agent ${input.agentName} enrolado.`,
    metadata: {
      siteId: input.siteId,
      agentName: input.agentName,
    },
  })

  if (!result.ok) {
    throw new Error(result.error.message)
  }
}

export async function recordNetworkAgentStatusChangedActivity(input: {
  companyId: string
  agentId: string
  agentName: string
  fromStatus: NetworkAgentStatus
  toStatus: NetworkAgentStatus
}): Promise<void> {
  const result = await activity.record({
    companyId: input.companyId,
    module: NETWORK_ACTIVITY_MODULE,
    entityType: NETWORK_ACTIVITY_ENTITY_AGENT,
    entityId: input.agentId,
    action: "AGENT_STATUS_CHANGED",
    category: ACTIVITY_CATEGORIES.TECHNICAL,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.INTEGRATION,
    title: "Cambio de estado de Network Agent",
    description: `Agent ${input.agentName}: ${input.fromStatus} → ${input.toStatus}.`,
    metadata: {
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      agentName: input.agentName,
    },
  })

  if (!result.ok) {
    throw new Error(result.error.message)
  }
}

export async function recordNetworkDiscoveryFinishedActivity(input: {
  companyId: string
  agentId: string
  agentName: string
  jobId: string
  ok: boolean
  errorMessage: string | null
  hostname: string | null
}): Promise<void> {
  const result = await activity.record({
    companyId: input.companyId,
    module: NETWORK_ACTIVITY_MODULE,
    entityType: NETWORK_ACTIVITY_ENTITY_JOB,
    entityId: input.jobId,
    action: input.ok ? "DISCOVERY_COMPLETED" : "DISCOVERY_FAILED",
    category: ACTIVITY_CATEGORIES.TECHNICAL,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.INTEGRATION,
    title: input.ok ? "Discovery de red completado" : "Discovery de red fallido",
    description: input.ok
      ? `Agent ${input.agentName} descubrió ${input.hostname ?? "infraestructura"}.`
      : `Agent ${input.agentName}: ${input.errorMessage ?? "discovery falló"}.`,
    metadata: {
      agentId: input.agentId,
      agentName: input.agentName,
      hostname: input.hostname,
      errorMessage: input.errorMessage,
    },
  })

  if (!result.ok) {
    throw new Error(result.error.message)
  }
}

export { recordNetworkDeviceStatusChangedActivity } from "@/lib/network/monitoring/activity"
