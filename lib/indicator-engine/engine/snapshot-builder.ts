import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import type { SnapshotIdentity } from "@/lib/indicator-engine/snapshot/identity"
import type { SnapshotPayload } from "@/lib/indicator-engine/snapshot/payload"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { SnapshotStatus } from "@/lib/indicator-engine/snapshot/status"
import type { IndicatorValue } from "@/lib/indicator-engine/types/analysis-unit"
import { assertPipelineContextValidInDevelopment } from "@/lib/indicator-engine/pipeline/validate-pipeline"
import { assertBusinessSnapshotValidInDevelopment } from "@/lib/indicator-engine/snapshot/validate-snapshot"

export type CreateSnapshotInput = {
  readonly context: PipelineContext
  /** Pre-resolved indicator values — engine does not calculate them. */
  readonly indicators: Readonly<Record<string, IndicatorValue>>
  readonly status?: SnapshotStatus
  /** ISO clock override for deterministic tests. */
  readonly now?: string
  readonly payloadMetadata?: Readonly<Record<string, unknown>>
}

function identityFromContext(context: PipelineContext): SnapshotIdentity {
  return {
    companyId: context.companyId,
    date: context.date,
    scope: context.scope,
    subjectId: context.subjectId,
    version: context.version,
  }
}

/**
 * In-memory Snapshot Builder.
 * Returns a complete BusinessSnapshot. No persistence / I/O.
 */
export function createSnapshot(input: CreateSnapshotInput): BusinessSnapshot {
  assertPipelineContextValidInDevelopment(input.context)

  if (input.indicators == null || typeof input.indicators !== "object") {
    throw new Error("createSnapshot requires indicators object.")
  }

  const now = input.now ?? new Date().toISOString()
  const status = input.status ?? "ready"

  const payload: SnapshotPayload = {
    indicators: { ...input.indicators },
    status,
    timestamps: {
      createdAt: now,
      updatedAt: now,
      calculatedAt: status === "ready" || status === "reconciled" ? now : null,
    },
    metadata: {
      ...input.context.metadata,
      ...(input.payloadMetadata ?? {}),
      source: "indicator-engine.in-memory",
    },
    version: input.context.catalogVersion,
    updateMode: "bootstrap",
  }

  const snapshot: BusinessSnapshot = {
    identity: identityFromContext(input.context),
    payload,
  }

  assertBusinessSnapshotValidInDevelopment(snapshot)
  return snapshot
}
