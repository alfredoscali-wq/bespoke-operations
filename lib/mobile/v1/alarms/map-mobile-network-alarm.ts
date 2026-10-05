import type { NetworkAlarmDto } from "@/lib/network/alarms/contract"

export type MobileNetworkAlarm = {
  id: string
  deviceId: string
  severity: NetworkAlarmDto["severity"]
  status: NetworkAlarmDto["status"]
  title: string
  message: string
  createdAt: string
  seenAt: string | null
  acknowledgedAt: string | null
  resolvedAt: string | null
}

export function mapMobileNetworkAlarm(
  alarm: NetworkAlarmDto
): MobileNetworkAlarm {
  return {
    id: alarm.id,
    deviceId: alarm.deviceId,
    severity: alarm.severity,
    status: alarm.status,
    title: alarm.title,
    message: alarm.message,
    createdAt: alarm.createdAt,
    seenAt: alarm.seenAt,
    acknowledgedAt: alarm.acknowledgedAt,
    resolvedAt: alarm.resolvedAt,
  }
}
