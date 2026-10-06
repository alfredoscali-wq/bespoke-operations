import type { SupabaseClient } from "@supabase/supabase-js"

import type { NetworkAlarmRecord } from "@/lib/network/alarms/contract"
import { applyNetworkAlarmActions } from "@/lib/network/alarms/queries"
import {
  notifyNetworkAlarmOpened,
  type NetworkAlarmPushSendResult,
  type NotifyNetworkAlarmOpenedDeps,
} from "@/lib/network/push/send-alarm"
import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>

export const TEST_FCM_ALARM_MARKER = "TEST-FCM-ALARM"
export const TEST_FCM_ALARM_TITLE = "PRUEBA FCM — ALARMA CRITICAL"
export const TEST_FCM_ALARM_MESSAGE =
  "PRUEBA FCM — ALARMA CRITICAL. Dispositivo ficticio TEST-FCM-ALARM. No es un equipo real."

export function testFcmAlarmFingerprint(companyId: string): string {
  return `test-fcm-alarm:${companyId.trim()}`
}

export type TestFcmAlarmNotify = (
  client: Client,
  alarm: NetworkAlarmRecord
) => Promise<NetworkAlarmPushSendResult>

export type CreateTestFcmNetworkAlarmDeps = NotifyNetworkAlarmOpenedDeps & {
  notifyOpened?: TestFcmAlarmNotify
  now?: () => string
  createId?: () => string
}

export type TestFcmNetworkAlarmResult = {
  alarmId: string
  recipientCount: number
  sent: number
  failed: number
  outcome: NetworkAlarmPushSendResult["outcome"]
}

export type CleanupTestFcmNetworkAlarmResult = {
  alarmIds: string[]
  deviceIds: string[]
  eventsRetained: number
}

function emptyPushResult(): NetworkAlarmPushSendResult {
  return {
    attempted: false,
    outcome: "error",
    recipientCount: 0,
    sent: 0,
    failed: 0,
    invalidTokens: 0,
    results: [],
  }
}

function toHttpResult(
  alarmId: string,
  push: NetworkAlarmPushSendResult
): TestFcmNetworkAlarmResult {
  return {
    alarmId,
    recipientCount: push.recipientCount,
    sent: push.sent,
    failed: push.failed,
    outcome: push.outcome,
  }
}

async function findTestFcmDevices(
  client: Client,
  companyId: string
): Promise<Array<{ id: string }>> {
  const { data, error } = await client
    .from("network_devices")
    .select("id")
    .eq("company_id", companyId)
    .eq("fingerprint", testFcmAlarmFingerprint(companyId))
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function ensureTestFcmDevice(
  client: Client,
  companyId: string
): Promise<{ id: string }> {
  const existing = await findTestFcmDevices(client, companyId)
  if (existing[0]) return existing[0]

  const { data, error } = await client
    .from("network_devices")
    .insert({
      company_id: companyId,
      agent_id: null,
      site_id: null,
      fingerprint: testFcmAlarmFingerprint(companyId),
      hostname: TEST_FCM_ALARM_MARKER,
      manufacturer: TEST_FCM_ALARM_MARKER,
      model: TEST_FCM_ALARM_MARKER,
      serial_number: TEST_FCM_ALARM_MARKER,
      device_type: "other",
      management_ip: null,
      mac_address: null,
      firmware_version: null,
      status: "unknown",
      origin: "neighbor",
    })
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("No se pudo crear el dispositivo ficticio de prueba.")
  return data
}

async function listTestFcmAlarms(
  client: Client,
  companyId: string,
  deviceIds: string[]
): Promise<Array<{ id: string }>> {
  if (deviceIds.length === 0) return []
  const { data, error } = await client
    .from("network_alarms")
    .select("id")
    .eq("company_id", companyId)
    .eq("title", TEST_FCM_ALARM_TITLE)
    .in("device_id", deviceIds)
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function countAlarmEvents(
  client: Client,
  companyId: string,
  alarmIds: string[]
): Promise<number> {
  if (alarmIds.length === 0) return 0
  const { data, error } = await client
    .from("network_alarm_events")
    .select("id")
    .eq("company_id", companyId)
    .in("alarm_id", alarmIds)
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

async function softDeleteTestFcmAlarms(
  client: Client,
  companyId: string,
  alarmIds: string[],
  deletedAt: string
): Promise<void> {
  if (alarmIds.length === 0) return
  const { error } = await client
    .from("network_alarms")
    .update({ deleted_at: deletedAt })
    .eq("company_id", companyId)
    .in("id", alarmIds)
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
}

async function softDeleteTestFcmDevices(
  client: Client,
  companyId: string,
  deviceIds: string[],
  deletedAt: string
): Promise<void> {
  if (deviceIds.length === 0) return
  const { error } = await client
    .from("network_devices")
    .update({ deleted_at: deletedAt })
    .eq("company_id", companyId)
    .in("id", deviceIds)
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
}

function buildOpenTestAlarm(input: {
  companyId: string
  deviceId: string
  now: string
  id: string
}): NetworkAlarmRecord {
  return {
    id: input.id,
    companyId: input.companyId,
    deviceId: input.deviceId,
    severity: "critical",
    status: "open",
    title: TEST_FCM_ALARM_TITLE,
    message: TEST_FCM_ALARM_MESSAGE,
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

export async function createTestFcmNetworkAlarm(
  client: Client,
  companyId: string,
  deps: CreateTestFcmNetworkAlarmDeps = {}
): Promise<TestFcmNetworkAlarmResult> {
  const now = deps.now?.() ?? new Date().toISOString()
  const device = await ensureTestFcmDevice(client, companyId)
  const previous = await listTestFcmAlarms(client, companyId, [device.id])
  await softDeleteTestFcmAlarms(
    client,
    companyId,
    previous.map((row) => row.id),
    now
  )

  const alarm = buildOpenTestAlarm({
    companyId,
    deviceId: device.id,
    now,
    id: deps.createId?.() ?? crypto.randomUUID(),
  })

  let push = emptyPushResult()
  const notifyOpened: TestFcmAlarmNotify =
    deps.notifyOpened ??
    ((nextClient, nextAlarm) =>
      notifyNetworkAlarmOpened(nextClient, nextAlarm, deps))

  await applyNetworkAlarmActions(client, [{ type: "open", alarm }], async (nextClient, nextAlarm) => {
    push = await notifyOpened(nextClient, nextAlarm)
  })

  return toHttpResult(alarm.id, push)
}

export async function cleanupTestFcmNetworkAlarm(
  client: Client,
  companyId: string,
  now = new Date().toISOString()
): Promise<CleanupTestFcmNetworkAlarmResult> {
  const devices = await findTestFcmDevices(client, companyId)
  const deviceIds = devices.map((row) => row.id)
  const alarms = await listTestFcmAlarms(client, companyId, deviceIds)
  const alarmIds = alarms.map((row) => row.id)
  const eventsRetained = await countAlarmEvents(client, companyId, alarmIds)

  await softDeleteTestFcmAlarms(client, companyId, alarmIds, now)
  await softDeleteTestFcmDevices(client, companyId, deviceIds, now)

  return { alarmIds, deviceIds, eventsRetained }
}
