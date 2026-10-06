import type { NetworkAlarmPushDataPayload } from "@/lib/network/push/payload"
import type { NetworkAlarmPushRecipient } from "@/lib/network/push/recipients"

export const UNEQUIVOCAL_INVALID_FCM_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
])

export type AlarmPushDispatchMessage = {
  token: string
  data: Record<string, string>
  notification: {
    title: string
    body: string
  }
}

export type AlarmPushDispatchResponse = {
  success: boolean
  errorCode?: string | null
}

export type AlarmPushMessenger = {
  sendEach(
    messages: AlarmPushDispatchMessage[]
  ): Promise<{ responses: AlarmPushDispatchResponse[] }>
}

export type NetworkAlarmPushDispatchResult = {
  recipientCount: number
  sent: number
  failed: number
  invalidTokens: number
  results: AlarmPushRecipientResult[]
}

export type AlarmPushRecipientResult = {
  userId: string
  success: boolean
  errorCode: string | null
}

export function isUnequivocalInvalidFcmToken(errorCode: string | null | undefined): boolean {
  return Boolean(errorCode && UNEQUIVOCAL_INVALID_FCM_TOKEN_CODES.has(errorCode))
}

export type NetworkPushDispatchContent = {
  data: Record<string, string>
  notification: {
    title: string
    body: string
  }
}

export async function dispatchNetworkPush(
  recipients: readonly NetworkAlarmPushRecipient[],
  content: NetworkPushDispatchContent,
  messenger: AlarmPushMessenger
): Promise<NetworkAlarmPushDispatchResult> {
  const recipientCount = recipients.length
  if (recipientCount === 0) {
    return { recipientCount: 0, sent: 0, failed: 0, invalidTokens: 0, results: [] }
  }

  const messages: AlarmPushDispatchMessage[] = recipients.map((recipient) => ({
    token: recipient.pushToken,
    data: content.data,
    notification: content.notification,
  }))

  const batch = await messenger.sendEach(messages)
  let sent = 0
  let failed = 0
  let invalidTokens = 0

  for (let index = 0; index < messages.length; index += 1) {
    const response = batch.responses[index]
    if (response?.success) {
      sent += 1
      continue
    }
    failed += 1
    if (isUnequivocalInvalidFcmToken(response?.errorCode)) {
      invalidTokens += 1
    }
  }

  const results: AlarmPushRecipientResult[] = recipients.map((recipient, index) => ({
    userId: recipient.userId,
    success: Boolean(batch.responses[index]?.success),
    errorCode: batch.responses[index]?.errorCode ?? null,
  }))

  return { recipientCount, sent, failed, invalidTokens, results }
}

export async function dispatchNetworkAlarmPush(
  recipients: readonly NetworkAlarmPushRecipient[],
  payload: NetworkAlarmPushDataPayload,
  messenger: AlarmPushMessenger
): Promise<NetworkAlarmPushDispatchResult> {
  return dispatchNetworkPush(
    recipients,
    {
      data: {
        type: payload.type,
        alarmId: payload.alarmId,
        companyId: payload.companyId,
        severity: payload.severity,
        title: payload.title,
        message: payload.message,
      },
      notification: {
        title: payload.title,
        body: payload.message,
      },
    },
    messenger
  )
}
