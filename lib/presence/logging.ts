import type { PresenceEventType } from "@/lib/presence/constants"

type PresenceLogLevel = "warn" | "error"

function logPresence(
  level: PresenceLogLevel,
  message: string,
  details?: Record<string, unknown>
) {
  const payload = {
    engine: "PresenceEngine",
    message,
    ...details,
  }
  if (level === "error") {
    console.error("[PresenceEngine]", payload)
    return
  }
  console.warn("[PresenceEngine]", payload)
}

/** Validation / business rejections — not HEARTBEAT noise. */
export function logPresenceRejection(
  reason: string,
  details?: Record<string, unknown>
) {
  logPresence("warn", reason, details)
}

export function logPresenceInconsistency(
  reason: string,
  details?: Record<string, unknown>
) {
  logPresence("warn", reason, details)
}

export function logPresenceError(
  reason: string,
  details?: Record<string, unknown>
) {
  logPresence("error", reason, details)
}

export function logPresenceEventRegistered(input: {
  eventType: PresenceEventType
  taskId: string
  employeeId: string
  duplicated: boolean
}) {
  // Skip routine HEARTBEAT success noise; keep ENTER/EXIT + duplicates.
  if (input.eventType === "HEARTBEAT" && !input.duplicated) {
    return
  }

  logPresence("warn", "presence_event_registered", {
    eventType: input.eventType,
    taskId: input.taskId,
    employeeId: input.employeeId,
    duplicated: input.duplicated,
  })
}
