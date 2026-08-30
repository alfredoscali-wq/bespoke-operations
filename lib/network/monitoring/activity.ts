import "server-only"

import { activity } from "@/lib/activity-engine"
import { ACTIVITY_CATEGORIES, ACTIVITY_IMPACTS, ACTIVITY_ORIGINS } from "@/lib/activity-engine/activity-types"
import {
  NETWORK_ACTIVITY_ENTITY_DEVICE,
  NETWORK_ACTIVITY_MODULE,
} from "@/lib/network/constants"

export async function recordNetworkDeviceStatusChangedActivity(input: {
  companyId: string
  agentId: string
  agentName: string
  deviceId: string
  previousStatus: string
  nextStatus: string
  consecutiveFailures: number
}): Promise<void> {
  const result = await activity.record({
    companyId: input.companyId,
    module: NETWORK_ACTIVITY_MODULE,
    entityType: NETWORK_ACTIVITY_ENTITY_DEVICE,
    entityId: input.deviceId,
    action: "DEVICE_STATUS_CHANGED",
    category: ACTIVITY_CATEGORIES.TECHNICAL,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: ACTIVITY_ORIGINS.INTEGRATION,
    title: "Cambio de estado operativo",
    description: `Device ${input.previousStatus} → ${input.nextStatus} (${input.agentName}).`,
    metadata: {
      agentId: input.agentId,
      agentName: input.agentName,
      fromStatus: input.previousStatus,
      toStatus: input.nextStatus,
      consecutiveFailures: input.consecutiveFailures,
    },
  })

  if (!result.ok) {
    throw new Error(result.error.message)
  }
}
