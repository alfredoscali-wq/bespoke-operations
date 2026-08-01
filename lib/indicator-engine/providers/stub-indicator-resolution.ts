import type { ActivityInput } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"
import { BUSINESS_INDICATOR_IDS } from "@/lib/indicator-engine/catalog/definitions"

/**
 * Stub indicator resolution for in-memory E2E only.
 *
 * NOT the production Indicator Resolution engine.
 * Counts actions naively so Snapshot/Brief builders have structural values.
 */
export function stubResolveIndicators(
  input: ActivityInput
): Readonly<Record<string, IndicatorValue>> {
  const events = input.events

  const countAction = (action: string) =>
    events.filter((event) => event.action === action).length

  const sorted = [...events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
  const first = sorted[0] ?? null
  const last = sorted.length > 0 ? sorted[sorted.length - 1]! : null

  const employeeIds = new Set(
    events
      .map((event) => event.employeeId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  )

  const activeTimeMs =
    first && last
      ? Math.max(0, Date.parse(last.createdAt) - Date.parse(first.createdAt))
      : 0

  return {
    [BUSINESS_INDICATOR_IDS.EVENTS_TOTAL]: events.length,
    [BUSINESS_INDICATOR_IDS.EMPLOYEES_ACTIVE]: employeeIds.size,
    [BUSINESS_INDICATOR_IDS.ATTENTIONS_CREATED]:
      countAction("attention.created") + countAction("CASE_CREATED"),
    [BUSINESS_INDICATOR_IDS.ATTENTIONS_RESOLVED]: countAction(
      "attention.resolved"
    ),
    [BUSINESS_INDICATOR_IDS.ATTENTIONS_TRANSFERRED]: countAction(
      "attention.transferred"
    ),
    [BUSINESS_INDICATOR_IDS.WORKORDERS_CREATED]: countAction(
      "workorder.created"
    ),
    [BUSINESS_INDICATOR_IDS.WORKORDERS_FINISHED]: countAction(
      "workorder.finished"
    ),
    [BUSINESS_INDICATOR_IDS.WORKORDERS_STARTED]: countAction(
      "workorder.started"
    ),
    [BUSINESS_INDICATOR_IDS.CUSTOMERS_CREATED]: countAction("customer.created"),
    [BUSINESS_INDICATOR_IDS.COMMERCIAL_COMPLETED]: countAction(
      "commercial_activity.completed"
    ),
    [BUSINESS_INDICATOR_IDS.RETENTIONS]: events.filter(
      (event) =>
        event.action === "NEXT_STEP_CHANGED" &&
        event.metadata.new_next_step === "realizar_retencion"
    ).length,
    [BUSINESS_INDICATOR_IDS.FIRST_EVENT_AT]: first?.createdAt ?? null,
    [BUSINESS_INDICATOR_IDS.LAST_EVENT_AT]: last?.createdAt ?? null,
    [BUSINESS_INDICATOR_IDS.ACTIVE_TIME_MS]: activeTimeMs,
  }
}
