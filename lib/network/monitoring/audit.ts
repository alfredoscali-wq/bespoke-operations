import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import { SYSTEM_AUDIT_ACTOR } from "@/lib/audit/system-actor"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"

export async function recordNetworkDeviceStatusChangedAudit(input: {
  companyId: string
  agentId: string
  agentName: string
  deviceId: string
  previousStatus: string
  nextStatus: string
  consecutiveFailures: number
}): Promise<void> {
  await recordAuditEventServer({
    module: AUDIT_MODULES.NETWORK,
    action: AUDIT_ACTIONS.NETWORK_DEVICE_STATUS_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.NETWORK_DEVICE,
    entityId: input.deviceId,
    entityLabel: input.deviceId,
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.NETWORK_DEVICE_STATUS_CHANGED,
      entityLabel: input.deviceId,
      fallback: `Device ${input.previousStatus} → ${input.nextStatus} (${input.agentName}).`,
    }),
    performedBy: SYSTEM_AUDIT_ACTOR,
    companyId: input.companyId,
    metadata: {
      agentId: input.agentId,
      fromStatus: input.previousStatus,
      toStatus: input.nextStatus,
      consecutiveFailures: input.consecutiveFailures,
    },
  })
}
