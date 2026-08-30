import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import { SYSTEM_AUDIT_ACTOR } from "@/lib/audit/system-actor"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"
import type { NetworkAgentStatus } from "@/lib/network/constants"

export async function recordNetworkAgentEnrolledAudit(input: {
  companyId: string
  agentId: string
  agentName: string
  siteId: string | null
  performedBy?: SessionUser | null
}): Promise<void> {
  await recordAuditEventServer({
    module: AUDIT_MODULES.NETWORK,
    action: AUDIT_ACTIONS.NETWORK_AGENT_ENROLLED,
    entityType: AUDIT_ENTITY_TYPES.NETWORK_AGENT,
    entityId: input.agentId,
    entityLabel: input.agentName,
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.NETWORK_AGENT_ENROLLED,
      entityLabel: input.agentName,
    }),
    performedBy: input.performedBy
      ? { kind: "user", sessionUser: input.performedBy }
      : SYSTEM_AUDIT_ACTOR,
    companyId: input.companyId,
    metadata: {
      siteId: input.siteId,
    },
  })
}

export async function recordNetworkAgentStatusChangedAudit(input: {
  companyId: string
  agentId: string
  agentName: string
  fromStatus: NetworkAgentStatus
  toStatus: NetworkAgentStatus
}): Promise<void> {
  await recordAuditEventServer({
    module: AUDIT_MODULES.NETWORK,
    action: AUDIT_ACTIONS.NETWORK_AGENT_STATUS_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.NETWORK_AGENT,
    entityId: input.agentId,
    entityLabel: input.agentName,
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.NETWORK_AGENT_STATUS_CHANGED,
      entityLabel: input.agentName,
      fallback: `Network Agent ${input.agentName}: ${input.fromStatus} → ${input.toStatus}.`,
    }),
    performedBy: SYSTEM_AUDIT_ACTOR,
    companyId: input.companyId,
    metadata: {
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
    },
  })
}

export async function recordNetworkDiscoveryFinishedAudit(input: {
  companyId: string
  agentId: string
  agentName: string
  jobId: string
  ok: boolean
  errorMessage: string | null
  hostname: string | null
}): Promise<void> {
  const action = input.ok
    ? AUDIT_ACTIONS.NETWORK_DISCOVERY_COMPLETED
    : AUDIT_ACTIONS.NETWORK_DISCOVERY_FAILED
  await recordAuditEventServer({
    module: AUDIT_MODULES.NETWORK,
    action,
    entityType: AUDIT_ENTITY_TYPES.NETWORK_AGENT_JOB,
    entityId: input.jobId,
    entityLabel: input.hostname ?? input.agentName,
    description: buildAuditDescription({
      action,
      entityLabel: input.hostname ?? input.agentName,
      fallback: input.ok
        ? `Discovery completado (${input.agentName}).`
        : `Discovery fallido (${input.agentName}): ${input.errorMessage ?? "error"}.`,
    }),
    performedBy: SYSTEM_AUDIT_ACTOR,
    companyId: input.companyId,
    metadata: {
      agentId: input.agentId,
      hostname: input.hostname,
      errorMessage: input.errorMessage,
    },
  })
}

export { recordNetworkDeviceStatusChangedAudit } from "@/lib/network/monitoring/audit"
