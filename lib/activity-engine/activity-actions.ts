/**
 * Activity Engine 1.1A — reusable action catalog.
 * Extensible: add keys without removing existing ones.
 */

export const ACTIVITY_ACTIONS = {
  CALL_STARTED: "CALL_STARTED",
  CALL_COMPLETED: "CALL_COMPLETED",
  CALL_FAILED: "CALL_FAILED",
  WHATSAPP_SENT: "WHATSAPP_SENT",
  WHATSAPP_RECEIVED: "WHATSAPP_RECEIVED",
  FOLLOW_UP_CREATED: "FOLLOW_UP_CREATED",
  FOLLOW_UP_UPDATED: "FOLLOW_UP_UPDATED",
  STATUS_CHANGED: "STATUS_CHANGED",
  NEXT_STEP_CHANGED: "NEXT_STEP_CHANGED",
  DERIVATION_CREATED: "DERIVATION_CREATED",
  OT_CREATED: "OT_CREATED",
  OT_COMPLETED: "OT_COMPLETED",
  CUSTOMER_CONFIRMED: "CUSTOMER_CONFIRMED",
  CUSTOMER_CANCELLED: "CUSTOMER_CANCELLED",
  PAYMENT_REGISTERED: "PAYMENT_REGISTERED",
  NOTE_CREATED: "NOTE_CREATED",
} as const

export type ActivityAction =
  (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS]

export function isActivityAction(value: unknown): value is ActivityAction {
  return (
    typeof value === "string" &&
    (Object.values(ACTIVITY_ACTIONS) as string[]).includes(value)
  )
}

export function listActivityActions(): ActivityAction[] {
  return Object.values(ACTIVITY_ACTIONS)
}
