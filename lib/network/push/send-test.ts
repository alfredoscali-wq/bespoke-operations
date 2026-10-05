import type { SupabaseClient } from "@supabase/supabase-js"

import type { SessionUser } from "@/lib/auth/types"
import { canAccessNetworkModule } from "@/lib/network/permissions"
import {
  dispatchNetworkPush,
  type AlarmPushMessenger,
  type NetworkAlarmPushDispatchResult,
} from "@/lib/network/push/dispatch"
import { fetchNetworkAlarmPushCandidates } from "@/lib/network/push/fetch-recipients"
import {
  selectNetworkAlarmPushRecipients,
  type NetworkAlarmPushCandidate,
} from "@/lib/network/push/recipients"
import { createFirebasePushMessenger } from "@/lib/network/push/send-alarm"
import { isAdministradorSessionUser } from "@/lib/roles/web-module-access"

/** Temporary production FCM check. Not part of the alarm product flow. */
export const NETWORK_PUSH_TEST_TYPE = "network_push_test"
export const NETWORK_PUSH_TEST_TITLE = "Bespoke — prueba FCM"
export const NETWORK_PUSH_TEST_BODY =
  "Prueba de notificación push desde Producción."

export type NetworkPushTestAuthResult =
  | { ok: true; companyId: string }
  | { ok: false; status: 401 | 400 | 403; message: string }

export type NetworkPushTestSendResult = NetworkAlarmPushDispatchResult & {
  attempted: boolean
  outcome:
    | "sent"
    | "no_recipients"
    | "firebase_unconfigured"
    | "firebase_unavailable"
    | "error"
}

export type SendNetworkPushTestDeps = {
  loadCandidates?: (companyId: string) => Promise<NetworkAlarmPushCandidate[]>
  resolveMessenger?: () => AlarmPushMessenger | null
}

export function authorizeNetworkPushTest(
  sessionUser: Pick<
    SessionUser,
    "companyId" | "systemRole" | "roleCode" | "moduleVisibility"
  > | null
): NetworkPushTestAuthResult {
  if (!sessionUser) {
    return {
      ok: false,
      status: 401,
      message: "Debe iniciar sesión para realizar esta acción.",
    }
  }

  if (!canAccessNetworkModule(sessionUser)) {
    return {
      ok: false,
      status: 403,
      message: "No tiene acceso a Network.",
    }
  }

  if (!isAdministradorSessionUser(sessionUser)) {
    return {
      ok: false,
      status: 403,
      message: "Solo un administrador puede realizar esta acción.",
    }
  }

  const companyId = sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return {
      ok: false,
      status: 400,
      message: "Empresa no resuelta para la sesión.",
    }
  }

  return { ok: true, companyId }
}

export function buildNetworkPushTestContent() {
  return {
    data: {
      type: NETWORK_PUSH_TEST_TYPE,
    },
    notification: {
      title: NETWORK_PUSH_TEST_TITLE,
      body: NETWORK_PUSH_TEST_BODY,
    },
  }
}

export function toNetworkPushTestResponse(result: NetworkPushTestSendResult) {
  return {
    data: {
      sent: result.sent,
      failed: result.failed,
      recipientCount: result.recipientCount,
    },
  }
}

function emptyResult(
  outcome: NetworkPushTestSendResult["outcome"]
): NetworkPushTestSendResult {
  return {
    attempted: false,
    outcome,
    recipientCount: 0,
    sent: 0,
    failed: 0,
    invalidTokens: 0,
  }
}

export async function sendNetworkPushTest(
  client: SupabaseClient,
  companyId: string,
  deps: SendNetworkPushTestDeps = {}
): Promise<NetworkPushTestSendResult> {
  try {
    const sessionCompanyId = companyId.trim()
    const candidates = deps.loadCandidates
      ? await deps.loadCandidates(sessionCompanyId)
      : await fetchNetworkAlarmPushCandidates(client, sessionCompanyId)
    const recipients = selectNetworkAlarmPushRecipients(
      sessionCompanyId,
      candidates
    )

    if (recipients.length === 0) {
      return emptyResult("no_recipients")
    }

    const resolveMessenger = deps.resolveMessenger ?? createFirebasePushMessenger
    const messenger = resolveMessenger()
    if (!messenger) {
      console.error("[network-push-test] Firebase Admin is not configured.", {
        companyId: sessionCompanyId,
        recipients: recipients.length,
      })
      return {
        attempted: false,
        outcome: "firebase_unconfigured",
        recipientCount: recipients.length,
        sent: 0,
        failed: 0,
        invalidTokens: 0,
      }
    }

    try {
      const dispatched = await dispatchNetworkPush(
        recipients,
        buildNetworkPushTestContent(),
        messenger
      )
      const result: NetworkPushTestSendResult = {
        ...dispatched,
        attempted: true,
        outcome: "sent",
      }
      console.info("[network-push-test]", {
        companyId: sessionCompanyId,
        recipients: result.recipientCount,
        sent: result.sent,
        failed: result.failed,
        outcome: result.outcome,
      })
      return result
    } catch {
      console.error("[network-push-test] FCM send failed.", {
        companyId: sessionCompanyId,
        recipients: recipients.length,
      })
      return {
        attempted: true,
        outcome: "firebase_unavailable",
        recipientCount: recipients.length,
        sent: 0,
        failed: recipients.length,
        invalidTokens: 0,
      }
    }
  } catch {
    console.error("[network-push-test] Failed to send test push.", {
      companyId,
    })
    return emptyResult("error")
  }
}
