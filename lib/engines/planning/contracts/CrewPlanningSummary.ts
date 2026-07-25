/**
 * OPS 2.3B — Planning Engine capacity / summary contracts.
 */

export type CrewCapacityStatus =
  | "empty"
  | "normal"
  | "high_load"
  | "overloaded"

export type CrewCapacity = {
  taskCount: number
  technicalMinutes: number
  travelMinutes: number
  /** Base → Primera OT (0 when base GPS missing or no OT). */
  departureMinutes: number
  /** Última OT → Base (0 when base GPS missing or no OT). */
  returnMinutes: number
  /** Sum of RouteService distances persisted on task_metadata. */
  travelDistanceMeters: number
  totalMinutes: number
  availableMinutes: number
  remainingMinutes: number
  overtimeMinutes: number
  /** (technical + travel) / available * 100, rounded. */
  occupancyPercent: number
  status: CrewCapacityStatus
}

export type PlanningWarningCode =
  | "MISSING_BASE_GPS"
  | "JOURNEY_EXCEEDED"
  | "NO_TASKS"
  | "TASK_MISSING_GPS"
  | "NEGATIVE_TRAVEL"
  | "INCONSISTENT_DURATION"

export type PlanningWarningSeverity = "info" | "warning"

export type PlanningWarning = {
  code: PlanningWarningCode
  severity: PlanningWarningSeverity
  message: string
}

/**
 * Complete crew assistant payload — UI renders only.
 */
export type CrewPlanningSummary = {
  crewId: string
  crewName: string
  /** 📍 Base display name for this jornada. */
  operationalBaseName: string
  operationalBaseAddress: string | null
  taskCount: number
  technicalMinutes: number
  travelMinutes: number
  /** Base → Primera OT minutes (0 when skipped). */
  departureMinutes: number
  /** Última OT → Base minutes (0 when skipped). */
  returnMinutes: number
  travelDistanceMeters: number
  /** e.g. "48,3 km" */
  travelDistanceLabel: string
  totalMinutes: number
  availableMinutes: number
  remainingMinutes: number
  occupancyPercent: number
  status: CrewCapacityStatus
  /** e.g. "🟢 Normal" */
  statusLabel: string
  recommendation: string
  warnings: PlanningWarning[]
  baseGpsAvailable: boolean
  /** Prepared for OPS 2.3C crew base config screen. */
  configureBaseHref: string
}
