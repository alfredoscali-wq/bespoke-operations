import type { NetworkAlarmRecord } from "@/lib/network/alarms/contract"

export const NETWORK_ALARM_PUSH_TYPE = "network_alarm"

export type NetworkAlarmPushDataPayload = {
  type: typeof NETWORK_ALARM_PUSH_TYPE
  alarmId: string
  companyId: string
  severity: string
  title: string
  message: string
}

export function buildNetworkAlarmPushPayload(
  alarm: Pick<
    NetworkAlarmRecord,
    "id" | "companyId" | "severity" | "title" | "message"
  >
): NetworkAlarmPushDataPayload {
  return {
    type: NETWORK_ALARM_PUSH_TYPE,
    alarmId: alarm.id,
    companyId: alarm.companyId,
    severity: alarm.severity,
    title: alarm.title,
    message: alarm.message,
  }
}
