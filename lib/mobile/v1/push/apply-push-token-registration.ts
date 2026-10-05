import type { StoredPushTokenRow } from "@/lib/mobile/v1/push/types"

export type ApplyPushTokenRegistrationInput = {
  companyId: string
  employeeId: string
  deviceId: string
  platform: "android"
  pushToken: string
  now: string
  newId: string
}

export function applyPushTokenRegistration(
  existing: StoredPushTokenRow[],
  input: ApplyPushTokenRegistrationInput
): StoredPushTokenRow[] {
  const next = existing.map((row) => {
    if (
      row.deleted_at == null &&
      row.company_id === input.companyId &&
      row.push_token === input.pushToken &&
      (row.user_id !== input.employeeId || row.device_id !== input.deviceId)
    ) {
      return {
        ...row,
        enabled: false,
        deleted_at: input.now,
        updated_at: input.now,
      }
    }
    return row
  })

  const currentIndex = next.findIndex(
    (row) =>
      row.deleted_at == null &&
      row.company_id === input.companyId &&
      row.user_id === input.employeeId &&
      row.device_id === input.deviceId
  )

  if (currentIndex >= 0) {
    const current = next[currentIndex]
    next[currentIndex] = {
      ...current,
      platform: input.platform,
      push_token: input.pushToken,
      enabled: true,
      last_seen_at: input.now,
      updated_at: input.now,
      deleted_at: null,
    }
    return next
  }

  next.push({
    id: input.newId,
    company_id: input.companyId,
    user_id: input.employeeId,
    device_id: input.deviceId,
    platform: input.platform,
    push_token: input.pushToken,
    enabled: true,
    last_seen_at: input.now,
    created_at: input.now,
    updated_at: input.now,
    deleted_at: null,
  })

  return next
}

export function publicPushTokenRegistrationResult(): { registered: true } {
  return { registered: true }
}
