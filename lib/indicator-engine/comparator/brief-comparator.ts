import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"
import {
  finalizeFieldResult,
  issue,
  noteTolerance,
  valuesEqual,
} from "@/lib/indicator-engine/comparator/compare-utils"
import { compareDigests } from "@/lib/indicator-engine/comparator/digest-comparator"
import { compareSnapshots } from "@/lib/indicator-engine/comparator/snapshot-comparator"
import type {
  ComparableBriefView,
  ComparableMetric,
  ComparableProductionBlock,
  ComparisonIssue,
  ComparisonTolerance,
  FieldComparisonResult,
} from "@/lib/indicator-engine/comparator/types"

/** IE 1.x ExecutiveBrief duck type (business fields only). */
export type LegacyExecutiveBriefLike = {
  readonly date: string
  readonly narrative: string
  readonly generalState: readonly ComparableMetric[]
  readonly production: readonly ComparableProductionBlock[]
  readonly operationalAlerts: readonly {
    readonly id: string
    readonly label: string
    readonly value: number
  }[]
  readonly relevantActivity: readonly {
    readonly action: string
    readonly title: string
    readonly description: string | null
    readonly entityType: string
    readonly entityId?: string | null
  }[]
  readonly snapshot: { readonly values: Readonly<Record<string, IndicatorValue>> }
  readonly firstEventAt: string | null
  readonly lastEventAt: string | null
  readonly activeTimeMs: number
}

function isLegacyBrief(value: unknown): value is LegacyExecutiveBriefLike {
  if (value == null || typeof value !== "object") return false
  if (!("snapshot" in value)) return false
  const snapshot = (value as LegacyExecutiveBriefLike).snapshot
  return snapshot != null && typeof snapshot === "object" && "values" in snapshot
}

function isBriefV2(value: unknown): value is ExecutiveBriefV2 {
  return (
    value != null &&
    typeof value === "object" &&
    "identity" in value &&
    "digest" in value
  )
}

export function briefViewFromLegacy(
  brief: LegacyExecutiveBriefLike
): ComparableBriefView {
  return {
    date: brief.date,
    narrative: brief.narrative,
    generalState: brief.generalState,
    production: brief.production,
    operationalAlerts: brief.operationalAlerts,
    relevantActivity: brief.relevantActivity.map((item) => ({
      action: item.action,
      title: item.title,
      description: item.description,
      entityType: item.entityType,
      entityId: item.entityId ?? null,
    })),
    firstEventAt: brief.firstEventAt,
    lastEventAt: brief.lastEventAt,
    activeTimeMs: brief.activeTimeMs,
    indicators: brief.snapshot.values,
  }
}

export function briefViewFromV2(brief: ExecutiveBriefV2): ComparableBriefView {
  return {
    date: brief.date,
    narrative: brief.narrative,
    generalState: brief.generalState,
    production: brief.production,
    operationalAlerts: brief.operationalAlerts,
    relevantActivity: brief.relevantActivity.map((item) => ({
      action: item.action,
      title: item.title,
      description: item.description,
      entityType: item.entityType,
      entityId: item.entityId,
    })),
    firstEventAt: brief.firstEventAt,
    lastEventAt: brief.lastEventAt,
    activeTimeMs: brief.activeTimeMs,
    indicators: brief.snapshot.payload.indicators,
  }
}

function resolveBriefView(
  value: ComparableBriefView | LegacyExecutiveBriefLike | ExecutiveBriefV2
): ComparableBriefView {
  if (isLegacyBrief(value)) return briefViewFromLegacy(value)
  if (isBriefV2(value)) return briefViewFromV2(value)
  return value as ComparableBriefView
}

function metricsById(
  metrics: readonly ComparableMetric[]
): Map<string, ComparableMetric> {
  const map = new Map<string, ComparableMetric>()
  for (const metric of metrics) {
    map.set(metric.id, metric)
  }
  return map
}

function compareMetricMaps(
  pathPrefix: string,
  left: readonly ComparableMetric[],
  right: readonly ComparableMetric[],
  differences: ComparisonIssue[],
  missing: ComparisonIssue[],
  unexpected: ComparisonIssue[],
  counters: { compared: number; matched: number }
): void {
  const leftMap = metricsById(left)
  const rightMap = metricsById(right)
  const ids = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort()

  for (const id of ids) {
    const path = `${pathPrefix}.${id}`
    const l = leftMap.get(id)
    const r = rightMap.get(id)
    counters.compared += 1

    if (l && !r) {
      missing.push(issue(path, l, undefined))
      continue
    }
    if (!l && r) {
      unexpected.push(issue(path, undefined, r))
      continue
    }
    if (!l || !r) continue

    if (valuesEqual(l.value, r.value) && valuesEqual(l.label, r.label)) {
      counters.matched += 1
    } else {
      differences.push(issue(path, l, r))
    }
  }
}

/**
 * ExecutiveBriefComparator — narrative, estado, resumen ejecutivo, indicadores.
 * Ignores scope UUIDs, nested snapshot timestamps/metadata, item ids/createdAt.
 */
export function compareExecutiveBriefs(
  legacy: ComparableBriefView | LegacyExecutiveBriefLike,
  next: ComparableBriefView | ExecutiveBriefV2,
  tolerance?: ComparisonTolerance
): FieldComparisonResult {
  try {
    noteTolerance(tolerance)
    const started = performance.now()

    const leftView = resolveBriefView(legacy)
    const rightView = resolveBriefView(next)

    const differences: ComparisonIssue[] = []
    const missing: ComparisonIssue[] = []
    const unexpected: ComparisonIssue[] = []
    const counters = { compared: 0, matched: 0 }

    const scalarPaths: [string, unknown, unknown][] = [
      ["date", leftView.date, rightView.date],
      ["narrative", leftView.narrative, rightView.narrative],
      ["firstEventAt", leftView.firstEventAt, rightView.firstEventAt],
      ["lastEventAt", leftView.lastEventAt, rightView.lastEventAt],
      ["activeTimeMs", leftView.activeTimeMs, rightView.activeTimeMs],
    ]

    for (const [path, expected, actual] of scalarPaths) {
      counters.compared += 1
      if (valuesEqual(expected, actual)) {
        counters.matched += 1
      } else {
        differences.push(issue(path, expected, actual))
      }
    }

    compareMetricMaps(
      "generalState",
      leftView.generalState,
      rightView.generalState,
      differences,
      missing,
      unexpected,
      counters
    )

    compareMetricMaps(
      "operationalAlerts",
      leftView.operationalAlerts,
      rightView.operationalAlerts,
      differences,
      missing,
      unexpected,
      counters
    )

    const leftBlocks = new Map(
      leftView.production.map((block) => [block.id, block] as const)
    )
    const rightBlocks = new Map(
      rightView.production.map((block) => [block.id, block] as const)
    )
    const blockIds = [
      ...new Set([...leftBlocks.keys(), ...rightBlocks.keys()]),
    ].sort()

    for (const blockId of blockIds) {
      const lb = leftBlocks.get(blockId)
      const rb = rightBlocks.get(blockId)
      counters.compared += 1

      if (lb && !rb) {
        missing.push(issue(`production.${blockId}`, lb, undefined))
        continue
      }
      if (!lb && rb) {
        unexpected.push(issue(`production.${blockId}`, undefined, rb))
        continue
      }
      if (!lb || !rb) continue

      if (!valuesEqual(lb.title, rb.title)) {
        differences.push(
          issue(`production.${blockId}.title`, lb.title, rb.title)
        )
      } else {
        counters.matched += 1
      }

      compareMetricMaps(
        `production.${blockId}.metrics`,
        lb.metrics,
        rb.metrics,
        differences,
        missing,
        unexpected,
        counters
      )
    }

    const digestPart = compareDigests(
      { items: leftView.relevantActivity },
      { items: rightView.relevantActivity },
      tolerance
    )
    differences.push(
      ...digestPart.differences.map((d) => ({
        ...d,
        path: d.path.replace(/^digest\./, "relevantActivity."),
      }))
    )
    missing.push(
      ...digestPart.missing.map((d) => ({
        ...d,
        path: d.path.replace(/^digest\./, "relevantActivity."),
      }))
    )
    unexpected.push(
      ...digestPart.unexpected.map((d) => ({
        ...d,
        path: d.path.replace(/^digest\./, "relevantActivity."),
      }))
    )
    counters.compared += digestPart.coverage.comparedFields
    counters.matched += digestPart.coverage.matchedFields

    const snapshotPart = compareSnapshots(
      { indicators: leftView.indicators },
      { indicators: rightView.indicators },
      tolerance
    )
    differences.push(
      ...snapshotPart.differences.map((d) => ({
        ...d,
        path: `brief.${d.path}`,
      }))
    )
    missing.push(
      ...snapshotPart.missing.map((d) => ({
        ...d,
        path: `brief.${d.path}`,
      }))
    )
    unexpected.push(
      ...snapshotPart.unexpected.map((d) => ({
        ...d,
        path: `brief.${d.path}`,
      }))
    )
    counters.compared += snapshotPart.coverage.comparedFields
    counters.matched += snapshotPart.coverage.matchedFields

    return finalizeFieldResult({
      differences,
      missing,
      unexpected,
      comparedFields: counters.compared,
      matchedFields: counters.matched,
      started,
    })
  } catch {
    return {
      match: false,
      differences: [issue("brief", "comparison_failed", "comparison_failed")],
      missing: [],
      unexpected: [],
      comparisonTimeMs: 0,
      coverage: { comparedFields: 0, matchedFields: 0, ratio: 0 },
    }
  }
}

export const executiveBriefComparator = {
  compare: compareExecutiveBriefs,
  fromLegacy: briefViewFromLegacy,
  fromV2: briefViewFromV2,
} as const
