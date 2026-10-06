import {
  isActiveNetworkAlarmStatus,
  type NetworkAlarmDto,
  type NetworkAlarmSeverity,
} from "@/lib/network/alarms/contract"
import type { NocTopologyForest, NocTopologyNode } from "@/lib/network/noc/types"

export type NocAlarmOverlay = {
  severity: Extract<NetworkAlarmSeverity, "critical" | "warning">
  isNew?: boolean
}

function walkNocNodes(
  nodes: readonly NocTopologyNode[],
  visit: (node: NocTopologyNode) => void
) {
  for (const node of nodes) {
    visit(node)
    walkNocNodes(node.children, visit)
  }
}

export function collectNocForestDeviceIds(
  forest: NocTopologyForest
): Set<string> {
  const ids = new Set<string>()
  walkNocNodes(forest.roots, (node) => ids.add(node.deviceId))
  return ids
}

export function listNocActiveAlarms(
  alarms: readonly NetworkAlarmDto[]
): NetworkAlarmDto[] {
  return alarms.filter((alarm) => isActiveNetworkAlarmStatus(alarm.status))
}

export function countNocAlarmKpis(alarms: readonly NetworkAlarmDto[]): {
  critical: number
  warning: number
} {
  const active = listNocActiveAlarms(alarms)
  return {
    critical: active.filter((alarm) => alarm.severity === "critical").length,
    warning: active.filter((alarm) => alarm.severity === "warning").length,
  }
}

export function highestAlarmSeverityForDevice(
  alarms: readonly NetworkAlarmDto[],
  deviceId: string
): NetworkAlarmSeverity | null {
  let warning = false
  for (const alarm of listNocActiveAlarms(alarms)) {
    if (alarm.deviceId !== deviceId) continue
    if (alarm.severity === "critical") return "critical"
    if (alarm.severity === "warning") warning = true
  }
  return warning ? "warning" : null
}

export function buildNocAlarmOverlayByDeviceId(
  forest: NocTopologyForest,
  alarms: readonly NetworkAlarmDto[],
  newCriticalIds?: ReadonlySet<string>
): Map<string, NocAlarmOverlay> {
  const inForest = collectNocForestDeviceIds(forest)
  const map = new Map<string, NocAlarmOverlay>()

  for (const alarm of listNocActiveAlarms(alarms)) {
    if (!inForest.has(alarm.deviceId)) continue
    const current = map.get(alarm.deviceId)
    const isNew = Boolean(
      newCriticalIds?.has(alarm.id) && alarm.severity === "critical"
    )
    if (!current) {
      map.set(alarm.deviceId, {
        severity: alarm.severity,
        isNew,
      })
      continue
    }
    if (alarm.severity === "critical" && current.severity !== "critical") {
      map.set(alarm.deviceId, {
        severity: "critical",
        isNew: isNew || Boolean(current.isNew),
      })
      continue
    }
    if (isNew && current.severity === "critical") {
      map.set(alarm.deviceId, { ...current, isNew: true })
    }
  }

  return map
}

export function nocActiveAlarmsForDevice(
  alarms: readonly NetworkAlarmDto[],
  deviceId: string
): NetworkAlarmDto[] {
  return listNocActiveAlarms(alarms).filter(
    (alarm) => alarm.deviceId === deviceId
  )
}
