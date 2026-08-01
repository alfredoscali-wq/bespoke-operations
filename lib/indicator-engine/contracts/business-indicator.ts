import type {
  IndicatorAnalysisUnit,
  IndicatorMeasureUnit,
} from "@/lib/indicator-engine/types/analysis-unit"
import type {
  BusinessIndicatorCategory,
  BusinessIndicatorOrigin,
  BusinessIndicatorOwner,
  BusinessIndicatorStatus,
} from "@/lib/indicator-engine/types/indicator-meta"
import type { BusinessIndicatorId } from "@/lib/indicator-engine/types"

/**
 * Official business indicator definition (Indicator Engine 2.0 Registry).
 *
 * Modules must not invent local KPIs — register here only.
 * Sprint 2: registry metadata only. No calculation / snapshot runtime.
 */
export type BusinessIndicator = {
  readonly id: BusinessIndicatorId
  readonly name: string
  readonly description: string
  readonly category: BusinessIndicatorCategory
  readonly unit: IndicatorMeasureUnit
  /** Scopes (analysis units) where this indicator is valid. */
  readonly scope: readonly IndicatorAnalysisUnit[]
  /** Semver (or semver-like) of this definition revision. */
  readonly version: string
  readonly status: BusinessIndicatorStatus
  readonly owner: BusinessIndicatorOwner
  readonly origin: BusinessIndicatorOrigin
  /**
   * Declared calculation kind from the legacy catalog (documentation / future).
   * Not executed by Indicator Engine 2.0 in this sprint.
   */
  readonly calculation: string
  /** Optional canonical activity modules that feed this indicator. */
  readonly modules?: readonly string[]
  /** Optional activity actions that feed this indicator. */
  readonly actions?: readonly string[]
  /** Optional entity_type filter. */
  readonly entityTypes?: readonly string[]
  /** Optional metadata equality filters. */
  readonly metadataEquals?: Readonly<Record<string, string>>
}
