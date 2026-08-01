/**
 * Sala de Situación Dual Read + Snapshot Read Integration (Sprints 12–20).
 *
 * Official UI path:
 * - engineMode v1|dual → Indicator Facade / Engine 1.x
 * - engineMode v2 → BusinessSnapshot + BusinessDigest when Comparator matches;
 *   otherwise automatic V1 fallback.
 *
 * Side path (dual|v2): Snapshot/Digest/Comparator/Telemetry from in-memory events.
 * Never queries Supabase — uses `events` already loaded by the API.
 */

import type { ExecutiveBrief } from "@/lib/executive/types"
import type { IndicatorSourceEvent } from "@/lib/indicators/types"
import { INDICATOR_ENGINE_CATALOG_VERSION } from "@/lib/indicator-engine/registry/official-registry"
import { indicatorFacade } from "@/lib/indicator-engine/facade/indicator-facade"
import { createDigest } from "@/lib/indicator-engine/engine/digest-builder"
import { createSnapshot } from "@/lib/indicator-engine/engine/snapshot-builder"
import type { BusinessDigestItem } from "@/lib/indicator-engine/contracts/digest"
import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { BusinessDigest } from "@/lib/indicator-engine/contracts/digest"
import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import { buildComparisonReport } from "@/lib/indicator-engine/comparator/comparison-report"
import type { ComparisonReport } from "@/lib/indicator-engine/comparator/types"
import {
  getIndicatorEngineFeatureFlags,
  isTelemetryEnabled,
  shouldRunDualReadSidePath,
} from "@/lib/indicator-engine/feature-flags"
import { startPerformanceTelemetry } from "@/lib/indicator-engine/telemetry/performance-telemetry"
import {
  resolveOfficialSituationRoomBrief,
  type OfficialSituationRoomSource,
} from "@/lib/indicator-engine/facade/official-situation-room-brief"

export type SituationRoomDualReadInput = {
  readonly companyId: string
  readonly date: string
  /**
   * Events already loaded for V1 — Dual Read must not fetch again.
   */
  readonly events: readonly IndicatorSourceEvent[]
}

export type SituationRoomDualReadResult = {
  /** Official response for UI (V1, or V2 projection when gated). */
  readonly brief: ExecutiveBrief
  /** Which engine path produced the official brief. */
  readonly officialSource: OfficialSituationRoomSource
  /** Present when Dual Read side path ran (Feature Flags). */
  readonly dualRead?: {
    readonly comparison: ComparisonReport
    readonly v1DurationMs: number
    readonly v2DurationMs: number
    readonly fallbackReason: string | null
  }
}

type DualReadSidePathResult = {
  readonly comparison: ComparisonReport
  readonly v1DurationMs: number
  readonly v2DurationMs: number
  readonly snapshot: BusinessSnapshot
  readonly digest: BusinessDigest
  readonly briefV2: ExecutiveBriefV2
}

type DualReadMemoryState = {
  lastComparison: ComparisonReport | null
  lastV1DurationMs: number
  lastV2DurationMs: number
  lastOfficialSource: OfficialSituationRoomSource
  lastFallbackReason: string | null
  runCount: number
}

const dualReadMemory: DualReadMemoryState = {
  lastComparison: null,
  lastV1DurationMs: 0,
  lastV2DurationMs: 0,
  lastOfficialSource: "v1",
  lastFallbackReason: null,
  runCount: 0,
}

export function getLastSituationRoomDualReadState(): Readonly<DualReadMemoryState> {
  return { ...dualReadMemory }
}

export function clearSituationRoomDualReadState(): void {
  dualReadMemory.lastComparison = null
  dualReadMemory.lastV1DurationMs = 0
  dualReadMemory.lastV2DurationMs = 0
  dualReadMemory.lastOfficialSource = "v1"
  dualReadMemory.lastFallbackReason = null
  dualReadMemory.runCount = 0
}

function toPipelineContext(
  companyId: string,
  date: string
): PipelineContext {
  return {
    companyId,
    date,
    scope: "company",
    subjectId: null,
    version: "1.0.0",
    catalogVersion: INDICATOR_ENGINE_CATALOG_VERSION,
    metadata: { dualRead: "situation-room" },
  }
}

function toDigestItems(
  brief: ExecutiveBrief
): readonly BusinessDigestItem[] {
  return brief.relevantActivity.map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    action: item.action,
    title: item.title,
    description: item.description,
    entityType: item.entityType,
    entityId: item.entityId,
    employeeId: item.employeeId,
  }))
}

/**
 * Build IE 2.0 artifacts from the same in-memory events / V1 business values.
 * No Supabase. No second event download. Snapshot Engine shapes only.
 */
function buildV2Artifacts(
  companyId: string,
  date: string,
  v1Brief: ExecutiveBrief
): {
  snapshot: BusinessSnapshot
  digest: BusinessDigest
  briefV2: ExecutiveBriefV2
} {
  const context = toPipelineContext(companyId, date)
  const snapshot = createSnapshot({
    context,
    indicators: v1Brief.snapshot.values,
  })
  const digest = createDigest({
    snapshot,
    items: toDigestItems(v1Brief),
  })
  const briefV2: ExecutiveBriefV2 = {
    identity: snapshot.identity,
    date: v1Brief.date,
    narrative: v1Brief.narrative,
    generalState: v1Brief.generalState,
    production: v1Brief.production,
    operationalAlerts: v1Brief.operationalAlerts,
    relevantActivity: digest.items,
    snapshot,
    digest,
    firstEventAt: v1Brief.firstEventAt,
    lastEventAt: v1Brief.lastEventAt,
    activeTimeMs: v1Brief.activeTimeMs,
  }
  return { snapshot, digest, briefV2 }
}

function runDualReadSidePath(
  input: SituationRoomDualReadInput,
  v1Brief: ExecutiveBrief,
  v1DurationMs: number
): DualReadSidePathResult | undefined {
  if (!shouldRunDualReadSidePath()) {
    return undefined
  }

  const v2Started = performance.now()
  const { snapshot, digest, briefV2 } = buildV2Artifacts(
    input.companyId,
    input.date,
    v1Brief
  )
  const v2DurationMs = Math.max(0, performance.now() - v2Started)

  const comparison = buildComparisonReport({
    legacySnapshot: v1Brief.snapshot,
    nextSnapshot: snapshot,
    legacyDigest: {
      items: v1Brief.relevantActivity.map((item) => ({
        action: item.action,
        title: item.title,
        description: item.description,
        entityType: item.entityType,
        entityId: item.entityId,
      })),
    },
    nextDigest: digest,
    legacyBrief: v1Brief,
    nextBrief: briefV2,
  })

  dualReadMemory.lastComparison = comparison
  dualReadMemory.lastV1DurationMs = v1DurationMs
  dualReadMemory.lastV2DurationMs = v2DurationMs
  dualReadMemory.runCount += 1

  if (isTelemetryEnabled()) {
    const session = startPerformanceTelemetry("dual_read")
    session.addEvents(input.events.length)
    session.addIndicators(Object.keys(v1Brief.snapshot.values).length)
    session.markStage("dual_read_v1", v1DurationMs)
    session.markStage("dual_read_v2", v2DurationMs)
    session.recordSnapshotBuilt(1)
    session.recordDigestBuilt(1)
    session.recordBriefBuilt(1)
    session.setMetadata("v1DurationMs", v1DurationMs)
    session.setMetadata("v2DurationMs", v2DurationMs)
    session.setMetadata("durationDeltaMs", Math.abs(v2DurationMs - v1DurationMs))
    session.setMetadata("comparatorMatch", comparison.match)
    session.setMetadata("comparatorCoverage", comparison.coverage.ratio)
    session.setMetadata(
      "indicatorCount",
      Object.keys(v1Brief.snapshot.values).length
    )
    session.finish()
  }

  return {
    comparison,
    v1DurationMs,
    v2DurationMs,
    snapshot,
    digest,
    briefV2,
  }
}

/**
 * Sala de Situación load path (Sprint 12 Dual Read + Sprint 20 Snapshot integration).
 */
export function loadSituationRoomViaDualRead(
  input: SituationRoomDualReadInput
): SituationRoomDualReadResult {
  const scope = { kind: "company" as const, label: "Empresa" }
  const flags = getIndicatorEngineFeatureFlags()

  const v1Started = performance.now()
  const v1Brief = indicatorFacade.getExecutiveBrief({
    scope,
    date: input.date,
    events: input.events,
  })
  const v1DurationMs = Math.max(0, performance.now() - v1Started)

  const sidePath = runDualReadSidePath(input, v1Brief, v1DurationMs)

  const official = resolveOfficialSituationRoomBrief({
    engineMode: flags.engineMode,
    v1Brief,
    briefV2: sidePath?.briefV2 ?? null,
    comparison: sidePath?.comparison ?? null,
    scope,
  })

  dualReadMemory.lastOfficialSource = official.source
  dualReadMemory.lastFallbackReason = official.fallbackReason

  return {
    brief: official.brief,
    officialSource: official.source,
    ...(sidePath
      ? {
          dualRead: {
            comparison: sidePath.comparison,
            v1DurationMs: sidePath.v1DurationMs,
            v2DurationMs: sidePath.v2DurationMs,
            fallbackReason: official.fallbackReason,
          },
        }
      : {}),
  }
}
