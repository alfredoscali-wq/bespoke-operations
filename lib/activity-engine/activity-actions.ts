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
  /** Customer Service — expediente created / closed */
  CASE_CREATED: "CASE_CREATED",
  CASE_CLOSED: "CASE_CLOSED",
  /** Customer Service — unified client contact (Sprint 1.1C) */
  CUSTOMER_INTERACTION: "CUSTOMER_INTERACTION",
  /** Presence Engine — business facts only (never HEARTBEAT) */
  PRESENCE_ENTER_RADIUS: "PRESENCE_ENTER_RADIUS",
  PRESENCE_EXIT_RADIUS: "PRESENCE_EXIT_RADIUS",
  /** Network Agent — enrollment and status changes */
  AGENT_ENROLLED: "AGENT_ENROLLED",
  AGENT_STATUS_CHANGED: "AGENT_STATUS_CHANGED",
  DISCOVERY_COMPLETED: "DISCOVERY_COMPLETED",
  DISCOVERY_FAILED: "DISCOVERY_FAILED",
  DEVICE_STATUS_CHANGED: "DEVICE_STATUS_CHANGED",
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
