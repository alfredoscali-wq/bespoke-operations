import { canonicalizeActivityModule } from "@/lib/indicators/module-aliases"
import type { ActivityTimelineEvent } from "@/lib/activity/activity-timeline-types"

export type DayGestionGroupKey = string

export type DayGestionRawGroup = {
  key: DayGestionGroupKey
  domain: "attention" | "generic"
  entityType: string
  entityId: string | null
  events: ActivityTimelineEvent[]
}

function metaString(
  metadata: Record<string, unknown>,
  key: string
): string | null {
  const value = metadata[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * Canonicalize attention dual-write entity types into one domain bucket.
 */
export function resolveGestionDomain(
  event: ActivityTimelineEvent
): "attention" | "generic" {
  const moduleName = canonicalizeActivityModule(event.module)
  const entityType = event.entityType.trim()
  if (
    moduleName === "atencion" ||
    entityType === "attention" ||
    entityType === "customer_atencion"
  ) {
    return "attention"
  }
  return "generic"
}

export function buildGestionGroupKey(event: ActivityTimelineEvent): string {
  const domain = resolveGestionDomain(event)
  const entityId = event.entityId?.trim() || null

  if (domain === "attention" && entityId) {
    return `attention:${entityId}`
  }

  if (entityId) {
    const entityType = event.entityType.trim() || "entity"
    return `${entityType}:${entityId}`
  }

  // No entity → singleton group (one visual card per event)
  return `event:${event.id}`
}

/**
 * Partition day events into gestion groups. Pure — no I/O.
 */
export function groupDayEventsIntoGestiones(
  events: readonly ActivityTimelineEvent[]
): DayGestionRawGroup[] {
  const map = new Map<string, DayGestionRawGroup>()

  for (const event of events) {
    const key = buildGestionGroupKey(event)
    const domain = resolveGestionDomain(event)
    const existing = map.get(key)
    if (existing) {
      existing.events.push(event)
      continue
    }
    map.set(key, {
      key,
      domain,
      entityType:
        domain === "attention"
          ? "attention"
          : event.entityType.trim() || "entity",
      entityId: event.entityId?.trim() || null,
      events: [event],
    })
  }

  const groups = [...map.values()]
  for (const group of groups) {
    group.events.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  groups.sort((a, b) => {
    const aStart = a.events[0]?.createdAt ?? ""
    const bStart = b.events[0]?.createdAt ?? ""
    return aStart.localeCompare(bStart)
  })

  return groups
}

export function readEventMetaString(
  event: ActivityTimelineEvent,
  key: string
): string | null {
  return metaString(event.metadata, key)
}

export function findLastMetaString(
  events: readonly ActivityTimelineEvent[],
  key: string
): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const value = readEventMetaString(events[i]!, key)
    if (value) return value
  }
  return null
}

export function findFirstMetaString(
  events: readonly ActivityTimelineEvent[],
  key: string
): string | null {
  for (const event of events) {
    const value = readEventMetaString(event, key)
    if (value) return value
  }
  return null
}

export function groupHasAction(
  events: readonly ActivityTimelineEvent[],
  actions: readonly string[]
): boolean {
  const set = new Set(actions)
  return events.some((event) => set.has(event.action))
}
