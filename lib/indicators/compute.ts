import {
  getIndicatorDefinition,
  INDICATOR_CATALOG,
  INDICATOR_IDS,
} from "@/lib/indicators/catalog"
import { canonicalizeActivityModule } from "@/lib/indicators/module-aliases"
import type {
  ComputeIndicatorsOptions,
  IndicatorDefinition,
  IndicatorSnapshot,
  IndicatorSourceEvent,
  IndicatorValue,
} from "@/lib/indicators/types"

type NormalizedEvent = IndicatorSourceEvent & {
  module: string
}

function normalizeEvent(event: IndicatorSourceEvent): NormalizedEvent {
  return {
    ...event,
    module: canonicalizeActivityModule(event.module),
  }
}

function matchesMetadata(
  event: NormalizedEvent,
  definition: IndicatorDefinition
): boolean {
  const expected = definition.metadataEquals
  if (!expected || Object.keys(expected).length === 0) return true
  const metadata = event.metadata ?? {}
  for (const [key, value] of Object.entries(expected)) {
    if (metadata[key] !== value) return false
  }
  return true
}

function matchesDefinition(
  event: NormalizedEvent,
  definition: IndicatorDefinition
): boolean {
  const hasModuleConstraint = Boolean(definition.modules?.length)
  const hasActionConstraint = Boolean(definition.actions?.length)
  const hasEntityTypeConstraint = Boolean(definition.entityTypes?.length)
  const hasAnyConstraint =
    hasModuleConstraint || hasActionConstraint || hasEntityTypeConstraint

  if (!hasAnyConstraint) {
    return matchesMetadata(event, definition)
  }

  if (hasModuleConstraint && !definition.modules!.includes(event.module)) {
    return false
  }
  if (hasActionConstraint && !definition.actions!.includes(event.action)) {
    return false
  }
  if (
    hasEntityTypeConstraint &&
    !definition.entityTypes!.includes(event.entityType ?? "")
  ) {
    return false
  }
  return matchesMetadata(event, definition)
}

function emptyValue(definition: IndicatorDefinition): IndicatorValue {
  switch (definition.unit) {
    case "timestamp_iso":
      return null
    case "milliseconds":
    case "count":
    default:
      return 0
  }
}

function computeOne(
  events: NormalizedEvent[],
  definition: IndicatorDefinition
): IndicatorValue {
  const matched = events.filter((event) => matchesDefinition(event, definition))

  switch (definition.calculation) {
    case "count_matching_events":
      return matched.length
    case "count_distinct_entity_ids": {
      const ids = new Set<string>()
      for (const event of matched) {
        const id = event.entityId?.trim()
        if (id) ids.add(id)
      }
      return ids.size
    }
    case "count_distinct_employee_ids": {
      const ids = new Set<string>()
      for (const event of matched) {
        const id = event.employeeId?.trim()
        if (id) ids.add(id)
      }
      return ids.size
    }
    case "count_distinct_canonical_modules": {
      const modules = new Set<string>()
      for (const event of matched) {
        if (event.module) modules.add(event.module)
      }
      return modules.size
    }
    case "min_created_at": {
      let min: string | null = null
      for (const event of matched) {
        if (!min || event.createdAt.localeCompare(min) < 0) {
          min = event.createdAt
        }
      }
      return min
    }
    case "max_created_at": {
      let max: string | null = null
      for (const event of matched) {
        if (!max || event.createdAt.localeCompare(max) > 0) {
          max = event.createdAt
        }
      }
      return max
    }
    case "span_first_to_last_ms": {
      let min: string | null = null
      let max: string | null = null
      for (const event of matched) {
        if (!min || event.createdAt.localeCompare(min) < 0) {
          min = event.createdAt
        }
        if (!max || event.createdAt.localeCompare(max) > 0) {
          max = event.createdAt
        }
      }
      if (!min || !max) return 0
      const from = new Date(min).getTime()
      const to = new Date(max).getTime()
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0
      return to - from
    }
    default:
      return emptyValue(definition)
  }
}

/**
 * Core Indicator Engine entry: transform Activity events into indicator values.
 * Always canonicalizes modules (customer_service → atencion) before matching.
 */
export function computeIndicatorSnapshot(
  events: readonly IndicatorSourceEvent[],
  options?: ComputeIndicatorsOptions
): IndicatorSnapshot {
  const normalized = events.map(normalizeEvent)
  const definitions = options?.indicatorIds?.length
    ? options.indicatorIds
        .map((id) => getIndicatorDefinition(id))
        .filter((d): d is IndicatorDefinition => Boolean(d))
    : [...INDICATOR_CATALOG]

  const values: Record<string, IndicatorValue> = {}
  for (const definition of definitions) {
    values[definition.id] = computeOne(normalized, definition)
  }
  return { values }
}

export function indicatorCount(
  snapshot: IndicatorSnapshot,
  id: string
): number {
  const value = snapshot.values[id]
  return typeof value === "number" ? value : 0
}

export function indicatorTimestamp(
  snapshot: IndicatorSnapshot,
  id: string
): string | null {
  const value = snapshot.values[id]
  return typeof value === "string" ? value : null
}

/** Group events by employeeId and compute a snapshot per employee. */
export function computeIndicatorSnapshotsByEmployee(
  events: readonly IndicatorSourceEvent[],
  options?: ComputeIndicatorsOptions
): Map<string, IndicatorSnapshot> {
  const byEmployee = new Map<string, IndicatorSourceEvent[]>()

  for (const event of events) {
    const employeeId = event.employeeId?.trim()
    if (!employeeId) continue
    const list = byEmployee.get(employeeId)
    if (list) list.push(event)
    else byEmployee.set(employeeId, [event])
  }

  const result = new Map<string, IndicatorSnapshot>()
  for (const [employeeId, employeeEvents] of byEmployee) {
    result.set(employeeId, computeIndicatorSnapshot(employeeEvents, options))
  }
  return result
}

/** Convenience: company-level snapshot for the day / period. */
export function computeCompanyIndicatorSnapshot(
  events: readonly IndicatorSourceEvent[],
  options?: ComputeIndicatorsOptions
): IndicatorSnapshot {
  return computeIndicatorSnapshot(events, options)
}

export function emptyIndicatorSnapshot(
  indicatorIds?: readonly string[]
): IndicatorSnapshot {
  const ids = indicatorIds?.length
    ? indicatorIds
    : INDICATOR_CATALOG.map((definition) => definition.id)
  const values: Record<string, IndicatorValue> = {}
  for (const id of ids) {
    const definition = getIndicatorDefinition(id)
    values[id] = definition ? emptyValue(definition) : 0
  }
  return { values }
}

/** Re-export ids for report adapters. */
export { INDICATOR_IDS }
