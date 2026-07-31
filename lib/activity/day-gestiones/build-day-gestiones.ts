import { groupDayEventsIntoGestiones } from "@/lib/activity/day-gestiones/group-events"
import { presentAttentionGestion } from "@/lib/activity/day-gestiones/present-attention"
import { presentGenericGestion } from "@/lib/activity/day-gestiones/present-generic"
import type {
  DayGestion,
  DayGestionNameMaps,
} from "@/lib/activity/day-gestiones/types"
import type { ActivityTimelineEvent } from "@/lib/activity/activity-timeline-types"

const EMPTY_NAMES: DayGestionNameMaps = {
  customers: new Map(),
  employees: new Map(),
}

/**
 * Build business gestiones for a person's day from Activity Engine events.
 * Presentation-only; does not persist or invent indicators.
 */
export function buildDayGestiones(
  events: readonly ActivityTimelineEvent[],
  names: DayGestionNameMaps = EMPTY_NAMES
): DayGestion[] {
  const groups = groupDayEventsIntoGestiones(events)
  return groups.map((group) =>
    group.domain === "attention"
      ? presentAttentionGestion(group, names)
      : presentGenericGestion(group, names)
  )
}

export function collectCustomerIdsFromGestiones(
  gestiones: readonly DayGestion[]
): string[] {
  const ids = new Set<string>()
  for (const gestion of gestiones) {
    if (gestion.customerId) ids.add(gestion.customerId)
  }
  return [...ids]
}

export function collectCustomerIdsFromEvents(
  events: readonly ActivityTimelineEvent[]
): string[] {
  const ids = new Set<string>()
  for (const event of events) {
    const value = event.metadata.customer_id ?? event.metadata.customerId
    if (typeof value === "string" && value.trim()) ids.add(value.trim())
  }
  return [...ids]
}
