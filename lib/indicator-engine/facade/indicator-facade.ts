import {
  buildExecutiveBrief,
  type BuildExecutiveBriefInput,
} from "@/lib/executive/build-executive-brief"
import { EXECUTIVE_RELEVANT_ACTIVITY_LIMIT } from "@/lib/executive/relevant-actions"
import type { ExecutiveBrief } from "@/lib/executive/types"
import {
  computeCompanyIndicatorSnapshot,
  computeIndicatorSnapshot,
  computeIndicatorSnapshotsByEmployee,
  emptyIndicatorSnapshot,
  indicatorCount,
  indicatorTimestamp,
} from "@/lib/indicators/compute"
import type {
  ComputeIndicatorsOptions,
  IndicatorSnapshot,
  IndicatorSourceEvent,
} from "@/lib/indicators/types"
import {
  getDefaultIndicatorFacadeConfig,
  resolveIndicatorFacadeBackend,
  type IndicatorFacadeConfig,
} from "@/lib/indicator-engine/facade/config"
import type { IndicatorFacadeDigest } from "@/lib/indicator-engine/facade/types"
import {
  hookFacadeGetBrief,
  hookFacadeGetDigest,
  hookFacadeGetSnapshot,
} from "@/lib/indicator-engine/telemetry/hooks"

export type IndicatorFacade = {
  readonly config: IndicatorFacadeConfig
  getSnapshot(
    events: readonly IndicatorSourceEvent[],
    options?: ComputeIndicatorsOptions
  ): IndicatorSnapshot
  getCompanySnapshot(
    events: readonly IndicatorSourceEvent[],
    options?: ComputeIndicatorsOptions
  ): IndicatorSnapshot
  getSnapshotsByEmployee(
    events: readonly IndicatorSourceEvent[],
    options?: ComputeIndicatorsOptions
  ): Map<string, IndicatorSnapshot>
  getEmptySnapshot(): IndicatorSnapshot
  getExecutiveBrief(input: BuildExecutiveBriefInput): ExecutiveBrief
  getDigest(input: BuildExecutiveBriefInput): IndicatorFacadeDigest
  indicatorCount(snapshot: IndicatorSnapshot, id: string): number
  indicatorTimestamp(
    snapshot: IndicatorSnapshot,
    id: string
  ): string | null
}

/**
 * Creates the official Indicator Facade.
 *
 * Feature Flags control migration mode (Sprint 13). Visible results always
 * come from Indicator Engine 1.x until a future sprint authorizes V2 render.
 */
export function createIndicatorFacade(
  config?: IndicatorFacadeConfig
): IndicatorFacade {
  const defaults = getDefaultIndicatorFacadeConfig()
  const resolvedConfig: IndicatorFacadeConfig = {
    backend: config?.backend ?? defaults.backend,
    features: {
      ...defaults.features,
      ...config?.features,
    },
  }

  // Visible path is always V1 — Feature Flags decide side paths elsewhere.
  void resolveIndicatorFacadeBackend(resolvedConfig)

  return {
    config: resolvedConfig,

    getSnapshot(events, options) {
      return hookFacadeGetSnapshot(events.length, () =>
        computeIndicatorSnapshot(events, options)
      )
    },

    getCompanySnapshot(events, options) {
      return hookFacadeGetSnapshot(events.length, () =>
        computeCompanyIndicatorSnapshot(events, options)
      )
    },

    getSnapshotsByEmployee(events, options) {
      return computeIndicatorSnapshotsByEmployee(events, options)
    },

    getEmptySnapshot() {
      return emptyIndicatorSnapshot()
    },

    getExecutiveBrief(input) {
      return hookFacadeGetBrief(input.events.length, () =>
        buildExecutiveBrief(input)
      )
    },

    getDigest(input) {
      return hookFacadeGetDigest(input.events.length, () => {
        const brief = buildExecutiveBrief(input)
        return {
          items: brief.relevantActivity,
          limit: EXECUTIVE_RELEVANT_ACTIVITY_LIMIT,
        }
      })
    },

    indicatorCount,
    indicatorTimestamp,
  }
}

/** Default singleton — Feature Flags decide mode; render path remains V1. */
export const indicatorFacade: IndicatorFacade = createIndicatorFacade()
