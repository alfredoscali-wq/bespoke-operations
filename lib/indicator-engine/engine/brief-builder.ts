import type {
  BuildExecutiveBriefV2Input,
  ExecutiveBriefMetric,
  ExecutiveBriefProductionBlock,
  ExecutiveBriefV2,
  ExecutiveBriefV2Builder,
} from "@/lib/indicator-engine/contracts/brief"
import { assertBusinessDigestValidInDevelopment } from "@/lib/indicator-engine/contracts/digest"
import { BUSINESS_INDICATOR_IDS } from "@/lib/indicator-engine/catalog/definitions"
import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"
import { assertBusinessSnapshotValidInDevelopment } from "@/lib/indicator-engine/snapshot/validate-snapshot"
import { assertExecutiveBriefValidInDevelopment } from "@/lib/indicator-engine/engine/validate-brief"

function asCount(value: IndicatorValue | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return 0
}

function asTimestamp(value: IndicatorValue | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value
  return null
}

function metric(
  id: string,
  label: string,
  value: number
): ExecutiveBriefMetric {
  return { id, label, value }
}

/**
 * Placeholder narrative — no real storytelling rules in Sprint 5.
 */
function buildPlaceholderNarrative(briefDate: string, scope: string): string {
  return `Brief placeholder for ${scope} on ${briefDate}. Narrative rules not implemented yet.`
}

function buildGeneralState(
  indicators: Readonly<Record<string, IndicatorValue>>
): readonly ExecutiveBriefMetric[] {
  return [
    metric(
      "employees_active",
      "Empleados activos",
      asCount(indicators[BUSINESS_INDICATOR_IDS.EMPLOYEES_ACTIVE])
    ),
    metric(
      "events_total",
      "Eventos totales",
      asCount(indicators[BUSINESS_INDICATOR_IDS.EVENTS_TOTAL])
    ),
  ]
}

function buildProduction(
  indicators: Readonly<Record<string, IndicatorValue>>
): readonly ExecutiveBriefProductionBlock[] {
  return [
    {
      id: "operations",
      title: "Operaciones",
      metrics: [
        metric(
          "wo_finished",
          "OT finalizadas",
          asCount(indicators[BUSINESS_INDICATOR_IDS.WORKORDERS_FINISHED])
        ),
        metric(
          "wo_started",
          "OT iniciadas",
          asCount(indicators[BUSINESS_INDICATOR_IDS.WORKORDERS_STARTED])
        ),
      ],
    },
    {
      id: "attention",
      title: "Atención",
      metrics: [
        metric(
          "att_created",
          "Consultas creadas",
          asCount(indicators[BUSINESS_INDICATOR_IDS.ATTENTIONS_CREATED])
        ),
        metric(
          "att_resolved",
          "Consultas resueltas",
          asCount(indicators[BUSINESS_INDICATOR_IDS.ATTENTIONS_RESOLVED])
        ),
      ],
    },
  ]
}

/**
 * In-memory Executive Brief Builder.
 * Joins Snapshot + Digest into Executive Brief V2 (no activity events).
 */
export function createBrief(input: BuildExecutiveBriefV2Input): ExecutiveBriefV2 {
  assertBusinessSnapshotValidInDevelopment(input.snapshot)
  assertBusinessDigestValidInDevelopment(input.digest)

  if (
    input.digest.identity.companyId !== input.snapshot.identity.companyId ||
    input.digest.identity.date !== input.snapshot.identity.date ||
    input.digest.identity.scope !== input.snapshot.identity.scope ||
    input.digest.identity.subjectId !== input.snapshot.identity.subjectId
  ) {
    throw new Error(
      "createBrief: digest identity must match snapshot identity."
    )
  }

  const { identity, payload } = input.snapshot
  const indicators = payload.indicators

  const brief: ExecutiveBriefV2 = {
    identity: { ...identity },
    date: identity.date,
    narrative: buildPlaceholderNarrative(identity.date, identity.scope),
    generalState: buildGeneralState(indicators),
    production: buildProduction(indicators),
    operationalAlerts: [],
    relevantActivity: input.digest.items,
    snapshot: input.snapshot,
    digest: input.digest,
    firstEventAt: asTimestamp(indicators[BUSINESS_INDICATOR_IDS.FIRST_EVENT_AT]),
    lastEventAt: asTimestamp(indicators[BUSINESS_INDICATOR_IDS.LAST_EVENT_AT]),
    activeTimeMs: asCount(indicators[BUSINESS_INDICATOR_IDS.ACTIVE_TIME_MS]),
  }

  assertExecutiveBriefValidInDevelopment(brief)
  return brief
}

export const executiveBriefV2Builder: ExecutiveBriefV2Builder = {
  build: createBrief,
}
