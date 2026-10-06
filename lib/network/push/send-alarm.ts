import type { SupabaseClient } from "@supabase/supabase-js"
import { getMessaging } from "firebase-admin/messaging"

import type { NetworkAlarmRecord } from "@/lib/network/alarms/contract"
import { getFirebaseAdminApp } from "@/lib/firebase/admin"
import { firebaseAdminUnavailableMessage } from "@/lib/firebase/service-account"
import {
  dispatchNetworkAlarmPush,
  type AlarmPushMessenger,
  type NetworkAlarmPushDispatchResult,
} from "@/lib/network/push/dispatch"
import { fetchNetworkAlarmPushCandidates } from "@/lib/network/push/fetch-recipients"
import { persistNetworkAlarmNotificationSends } from "@/lib/network/push/persist-notifications"
import { buildNetworkAlarmPushPayload } from "@/lib/network/push/payload"
import {
  selectNetworkAlarmPushRecipients,
  type NetworkAlarmPushCandidate,
} from "@/lib/network/push/recipients"

export type NetworkAlarmPushSendResult = NetworkAlarmPushDispatchResult & {
  attempted: boolean
  outcome:
    | "sent"
    | "no_recipients"
    | "firebase_unconfigured"
    | "firebase_unavailable"
    | "error"
}

export type NotifyNetworkAlarmOpenedDeps = {
  loadCandidates?: (
    companyId: string
  ) => Promise<NetworkAlarmPushCandidate[]>
  resolveMessenger?: () => AlarmPushMessenger | null
}

export function createFirebasePushMessenger(): AlarmPushMessenger | null {
  const admin = getFirebaseAdminApp()
  if (admin.status !== "ready") {
    return null
  }

  const messaging = getMessaging(admin.app)
  return {
    async sendEach(messages) {
      const batch = await messaging.sendEach(messages)
      return {
        responses: batch.responses.map((response) => ({
          success: response.success,
          errorCode: response.error?.code ?? null,
        })),
      }
    },
  }
}

function emptyResult(
  outcome: NetworkAlarmPushSendResult["outcome"]
): NetworkAlarmPushSendResult {
  return {
    attempted: false,
    outcome,
    recipientCount: 0,
    sent: 0,
    failed: 0,
    invalidTokens: 0,
    results: [],
  }
}

function logPushOutcome(
  alarm: Pick<NetworkAlarmRecord, "id" | "companyId" | "severity">,
  result: NetworkAlarmPushSendResult
) {
  const line = {
    alarmId: alarm.id,
    companyId: alarm.companyId,
    severity: alarm.severity,
    recipients: result.recipientCount,
    sent: result.sent,
    failed: result.failed,
    outcome: result.outcome,
  }
  if (
    result.outcome === "error" ||
    result.outcome === "firebase_unconfigured" ||
    result.outcome === "firebase_unavailable"
  ) {
    console.error("[network-push]", line)
    return
  }
  console.info("[network-push]", line)
}

function logPersistFailure(
  alarm: Pick<NetworkAlarmRecord, "id" | "companyId">,
  error: unknown
) {
  console.error("[network-push] Failed to persist alarm notifications.", {
    alarmId: alarm.id,
    companyId: alarm.companyId,
    message: error instanceof Error ? error.message : "unknown",
  })
}

async function persistNotificationAudit(
  client: SupabaseClient,
  alarm: Pick<NetworkAlarmRecord, "id" | "companyId">,
  input: {
    results: Array<{ employeeId: string; success: boolean; errorCode: string | null }>
    mode: "dispatched" | "not_attempted"
  }
) {
  try {
    await persistNetworkAlarmNotificationSends(client, {
      companyId: alarm.companyId,
      alarmId: alarm.id,
      results: input.results,
      mode: input.mode,
    })
  } catch (error) {
    logPersistFailure(alarm, error)
  }
}

export async function notifyNetworkAlarmOpened(
  client: SupabaseClient,
  alarm: Pick<
    NetworkAlarmRecord,
    "id" | "companyId" | "severity" | "title" | "message"
  >,
  deps: NotifyNetworkAlarmOpenedDeps = {}
): Promise<NetworkAlarmPushSendResult> {
  try {
    const candidates = deps.loadCandidates
      ? await deps.loadCandidates(alarm.companyId)
      : await fetchNetworkAlarmPushCandidates(client, alarm.companyId)
    const recipients = selectNetworkAlarmPushRecipients(
      alarm.companyId,
      candidates
    )

    if (recipients.length === 0) {
      return emptyResult("no_recipients")
    }

    const resolveMessenger = deps.resolveMessenger ?? createFirebasePushMessenger
    const messenger = resolveMessenger()
    if (!messenger) {
      await persistNotificationAudit(client, alarm, {
        mode: "not_attempted",
        results: recipients.map((recipient) => ({
          employeeId: recipient.userId,
          success: false,
          errorCode: null,
        })),
      })
      const result: NetworkAlarmPushSendResult = {
        attempted: false,
        outcome: "firebase_unconfigured",
        recipientCount: recipients.length,
        sent: 0,
        failed: 0,
        invalidTokens: 0,
        results: [],
      }
      console.error(
        "[network-push]",
        firebaseAdminUnavailableMessage("missing"),
        {
          alarmId: alarm.id,
          companyId: alarm.companyId,
          severity: alarm.severity,
          recipients: recipients.length,
        }
      )
      return result
    }

    try {
      const dispatched = await dispatchNetworkAlarmPush(
        recipients,
        buildNetworkAlarmPushPayload(alarm),
        messenger
      )
      await persistNotificationAudit(client, alarm, {
        mode: "dispatched",
        results: dispatched.results.map((item) => ({
          employeeId: item.userId,
          success: item.success,
          errorCode: item.errorCode,
        })),
      })
      const result: NetworkAlarmPushSendResult = {
        ...dispatched,
        attempted: true,
        outcome: "sent",
      }
      logPushOutcome(alarm, result)
      return result
    } catch {
      await persistNotificationAudit(client, alarm, {
        mode: "dispatched",
        results: recipients.map((recipient) => ({
          employeeId: recipient.userId,
          success: false,
          errorCode: "firebase_unavailable",
        })),
      })
      const result: NetworkAlarmPushSendResult = {
        attempted: true,
        outcome: "firebase_unavailable",
        recipientCount: recipients.length,
        sent: 0,
        failed: recipients.length,
        invalidTokens: 0,
        results: [],
      }
      console.error("[network-push] FCM send failed.", {
        alarmId: alarm.id,
        companyId: alarm.companyId,
        severity: alarm.severity,
        recipients: recipients.length,
      })
      return result
    }
  } catch {
    const result = emptyResult("error")
    console.error("[network-push] Failed to notify opened alarm.", {
      alarmId: alarm.id,
      companyId: alarm.companyId,
      severity: alarm.severity,
    })
    return result
  }
}
