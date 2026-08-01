/**
 * Official Situation Room brief selection (Sprint 20).
 *
 * dual / v1 → always V1.
 * v2 → Snapshot path only when Comparator matches with coverage; else V1 fallback.
 */

import type { ExecutiveBrief, ExecutiveBriefScope } from "@/lib/executive/types"
import type { ComparisonReport } from "@/lib/indicator-engine/comparator/types"
import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import type { IndicatorEngineMode } from "@/lib/indicator-engine/feature-flags"
import { projectSnapshotBriefToExecutiveBrief } from "@/lib/indicator-engine/facade/project-snapshot-brief"

export type OfficialSituationRoomSource = "v1" | "v2"

export type OfficialSituationRoomBriefResult = {
  readonly brief: ExecutiveBrief
  readonly source: OfficialSituationRoomSource
  readonly fallbackReason: string | null
}

export function canServeSnapshotOfficialBrief(
  comparison: ComparisonReport | null | undefined
): boolean {
  if (!comparison) return false
  if (!comparison.match) return false
  if (comparison.coverage.comparedFields <= 0) return false
  return true
}

/**
 * Resolve which brief Sala may render.
 * Never returns a V2-sourced brief when Comparator diverges or is inactive.
 */
export function resolveOfficialSituationRoomBrief(input: {
  readonly engineMode: IndicatorEngineMode
  readonly v1Brief: ExecutiveBrief
  readonly briefV2: ExecutiveBriefV2 | null
  readonly comparison: ComparisonReport | null
  readonly scope: ExecutiveBriefScope
}): OfficialSituationRoomBriefResult {
  if (input.engineMode !== "v2") {
    return {
      brief: input.v1Brief,
      source: "v1",
      fallbackReason: null,
    }
  }

  if (!input.briefV2) {
    return {
      brief: input.v1Brief,
      source: "v1",
      fallbackReason: "missing_v2_artifacts",
    }
  }

  if (!canServeSnapshotOfficialBrief(input.comparison)) {
    const reason = !input.comparison
      ? "comparator_missing"
      : !input.comparison.match
        ? "comparator_mismatch"
        : "comparator_no_coverage"
    return {
      brief: input.v1Brief,
      source: "v1",
      fallbackReason: reason,
    }
  }

  return {
    brief: projectSnapshotBriefToExecutiveBrief(input.briefV2, input.scope),
    source: "v2",
    fallbackReason: null,
  }
}
