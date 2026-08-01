/**
 * Public types exposed by Indicator Facade.
 * Screens should depend on these — never on engine internals.
 */

export type {
  ComputeIndicatorsOptions,
  IndicatorSourceEvent,
  IndicatorSnapshot,
  IndicatorValue,
} from "@/lib/indicators/types"

export type {
  ExecutiveBrief,
  ExecutiveBriefScope,
  ExecutiveBriefScopeKind,
  ExecutiveMetric,
  ExecutiveOperationalAlert,
  ExecutiveProductionBlock,
  ExecutiveRelevantActivityItem,
} from "@/lib/executive/types"

export type { BuildExecutiveBriefInput } from "@/lib/executive/build-executive-brief"

/**
 * Facade digest = executive relevant activity slice (IE 1.x equivalent).
 * Named for future BusinessDigest parity without exposing IE 2.0 types.
 */
export type IndicatorFacadeDigest = {
  readonly items: readonly import("@/lib/executive/types").ExecutiveRelevantActivityItem[]
  readonly limit: number
}
