/**
 * Activity Engine 1.1A — foundational types.
 * Independent catalog. Do not import domain modules here.
 */

export const ACTIVITY_CATEGORIES = {
  CONTACT: "CONTACT",
  FOLLOW_UP: "FOLLOW_UP",
  TECHNICAL: "TECHNICAL",
  ADMINISTRATIVE: "ADMINISTRATIVE",
  SALES: "SALES",
  OPERATIONAL: "OPERATIONAL",
  SYSTEM: "SYSTEM",
  COMMUNICATION: "COMMUNICATION",
} as const

export type ActivityCategory =
  (typeof ACTIVITY_CATEGORIES)[keyof typeof ACTIVITY_CATEGORIES]

export const ACTIVITY_IMPACTS = {
  ACTIVITY: "ACTIVITY",
  PRODUCTION: "PRODUCTION",
  RESULT: "RESULT",
} as const

export type ActivityImpact =
  (typeof ACTIVITY_IMPACTS)[keyof typeof ACTIVITY_IMPACTS]

export const ACTIVITY_ORIGINS = {
  USER: "USER",
  SYSTEM: "SYSTEM",
  AUTOMATION: "AUTOMATION",
  INTEGRATION: "INTEGRATION",
} as const

export type ActivityOrigin =
  (typeof ACTIVITY_ORIGINS)[keyof typeof ACTIVITY_ORIGINS]

export type ActivityEngineRecordInput = {
  companyId: string
  module: string
  entityType: string
  entityId: string
  employeeId?: string | null
  action: string
  category: ActivityCategory
  impact: ActivityImpact
  origin: ActivityOrigin
  metadata?: Record<string, unknown>
}

export type ActivityEngineEvent = {
  id: string
  companyId: string
  module: string
  entityType: string
  entityId: string
  employeeId: string | null
  action: string
  category: ActivityCategory
  impact: ActivityImpact
  origin: ActivityOrigin
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type ActivityEngineErrorCode =
  | "VALIDATION_ERROR"
  | "PERSISTENCE_ERROR"

export type ActivityEngineError = {
  code: ActivityEngineErrorCode
  message: string
  field?: string
}

export type ActivityEngineRecordResult =
  | { ok: true; data: ActivityEngineEvent }
  | { ok: false; error: ActivityEngineError }

export function isActivityCategory(value: unknown): value is ActivityCategory {
  return (
    typeof value === "string" &&
    (Object.values(ACTIVITY_CATEGORIES) as string[]).includes(value)
  )
}

export function isActivityImpact(value: unknown): value is ActivityImpact {
  return (
    typeof value === "string" &&
    (Object.values(ACTIVITY_IMPACTS) as string[]).includes(value)
  )
}

export function isActivityOrigin(value: unknown): value is ActivityOrigin {
  return (
    typeof value === "string" &&
    (Object.values(ACTIVITY_ORIGINS) as string[]).includes(value)
  )
}
