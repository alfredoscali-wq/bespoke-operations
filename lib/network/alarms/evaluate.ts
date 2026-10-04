import {
  NETWORK_ALARM_AUTO_RESOLVE_NOTE,
  networkAlarmMessageForRole,
  networkAlarmTitleForRole,
  type NetworkAlarmRecord,
  type NetworkAlarmRole,
  type NetworkAlarmSeverity,
} from "@/lib/network/alarms/contract"
import { severityForNetworkAlarmRole } from "@/lib/network/alarms/role"

export type NetworkAlarmAction =
  | {
      type: "open"
      alarm: NetworkAlarmRecord
    }
  | {
      type: "resolve"
      alarmId: string
      resolvedAt: string
      resolvedBy: string | null
      resolutionNote: string
    }
  | {
      type: "promote"
      alarmId: string
    }
  | {
      type: "attach"
      alarmId: string
      rootAlarmId: string
    }

export type NetworkAlarmEvaluateInput = {
  companyId: string
  deviceId: string
  previousStatus: string
  nextStatus: string
  now: string
  role: NetworkAlarmRole
  identity?: string | null
  activeAlarm: NetworkAlarmRecord | null
  offlineAncestorRootAlarm: NetworkAlarmRecord | null
  dependentsOfThisRoot: readonly NetworkAlarmRecord[]
  descendantActiveRootAlarms: readonly NetworkAlarmRecord[]
  statusByDeviceId: ReadonlyMap<string, string>
  ancestorIdsByDeviceId: ReadonlyMap<string, readonly string[]>
}

function createOpenAlarm(input: {
  companyId: string
  deviceId: string
  now: string
  role: NetworkAlarmRole
  severity: NetworkAlarmSeverity
  identity?: string | null
}): NetworkAlarmRecord {
  return {
    id: crypto.randomUUID(),
    companyId: input.companyId,
    deviceId: input.deviceId,
    severity: input.severity,
    status: "open",
    title: networkAlarmTitleForRole(input.role),
    message: networkAlarmMessageForRole(input.role, input.identity),
    rootAlarmId: null,
    isRoot: true,
    createdAt: input.now,
    seenAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
  }
}

/**
 * Alarmas 1.0: one alarm per managed device from Monitoring transitions.
 * Opens only on online → offline. Resolves on offline → online.
 * Does not correlate, attach, promote, or walk Discovery ancestry.
 */
export function evaluateNetworkAlarmTransition(
  input: NetworkAlarmEvaluateInput
): NetworkAlarmAction[] {
  const severity = severityForNetworkAlarmRole(input.role)

  if (
    input.previousStatus === "online" &&
    input.nextStatus === "offline" &&
    severity
  ) {
    if (input.activeAlarm) return []
    return [
      {
        type: "open",
        alarm: createOpenAlarm({
          companyId: input.companyId,
          deviceId: input.deviceId,
          now: input.now,
          role: input.role,
          severity,
          identity: input.identity,
        }),
      },
    ]
  }

  if (input.previousStatus !== "offline" || input.nextStatus !== "online") {
    return []
  }

  if (!input.activeAlarm) return []

  return [
    {
      type: "resolve",
      alarmId: input.activeAlarm.id,
      resolvedAt: input.now,
      resolvedBy: null,
      resolutionNote: NETWORK_ALARM_AUTO_RESOLVE_NOTE,
    },
  ]
}

/** Kept for sync.ts. Alarmas 1.0 does not attach alarms to an ancestor root. */
export function findOfflineAncestorRootAlarm(
  _deviceId: string,
  _ancestorIdsByDeviceId: ReadonlyMap<string, readonly string[]>,
  _statusByDeviceId: ReadonlyMap<string, string>,
  _activeRootByDeviceId: ReadonlyMap<string, NetworkAlarmRecord>
): NetworkAlarmRecord | null {
  return null
}
