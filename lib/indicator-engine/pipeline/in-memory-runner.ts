import type { ActivityAdapter } from "@/lib/indicator-engine/adapters/activity-adapter"
import { activityAdapter } from "@/lib/indicator-engine/adapters/registry"
import type { BusinessDigestItem } from "@/lib/indicator-engine/contracts/digest"
import { snapshotEngine } from "@/lib/indicator-engine/engine/snapshot-engine"
import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import type { PipelineResult } from "@/lib/indicator-engine/pipeline/result"
import type { ActivityInput } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import type { NormalizeOutput } from "@/lib/indicator-engine/pipeline/stages/normalize"
import {
  assertActivityInputValidInDevelopment,
  assertPipelineContextValidInDevelopment,
  assertPipelineResultValidInDevelopment,
} from "@/lib/indicator-engine/pipeline/validate-pipeline"
import type { ActivityProvider } from "@/lib/indicator-engine/providers/types"
import { stubResolveIndicators } from "@/lib/indicator-engine/providers/stub-indicator-resolution"
import { assertBusinessSnapshotValidInDevelopment } from "@/lib/indicator-engine/snapshot/validate-snapshot"
import { assertBusinessDigestValidInDevelopment } from "@/lib/indicator-engine/contracts/digest"
import { assertExecutiveBriefValidInDevelopment } from "@/lib/indicator-engine/engine/validate-brief"

export type InMemoryPipelineRunInput = {
  readonly context: PipelineContext
  readonly provider: ActivityProvider
  readonly adapter?: ActivityAdapter
  readonly now?: string
}

export type InMemoryPipelineRunOutput = {
  readonly activityInput: ActivityInput
  readonly normalized: NormalizeOutput
  readonly result: PipelineResult
}

function normalizeActivityInput(input: ActivityInput): NormalizeOutput {
  return {
    facts: input.events.map((event) => ({
      id: event.id ?? undefined,
      module: event.module,
      action: event.action,
      entityType: event.entityType ?? "",
      entityId: event.entityId,
      employeeId: event.employeeId,
      createdAt: event.createdAt,
      metadata: event.metadata,
      title: event.title,
      description: event.description,
    })),
  }
}

function toDigestItems(input: ActivityInput): readonly BusinessDigestItem[] {
  return input.events.map((event) => ({
    id: event.id ?? `${event.action}:${event.createdAt}`,
    createdAt: event.createdAt,
    action: event.action,
    title: event.title ?? event.action,
    description: event.description,
    entityType: event.entityType ?? "",
    entityId: event.entityId,
    employeeId: event.employeeId,
  }))
}

function filterInputForEmployeeScope(
  input: ActivityInput,
  context: PipelineContext
): ActivityInput {
  if (context.scope !== "employee" || !context.subjectId) {
    return input
  }
  return {
    events: input.events.filter(
      (event) => event.employeeId === context.subjectId
    ),
  }
}

/**
 * End-to-end in-memory pipeline runner (Sprint 7).
 *
 * Provider → Adapter → Normalize → Stub indicators → Snapshot Engine
 * → Digest → Brief → PipelineResult
 *
 * No Supabase. No Activity Engine imports. No real indicator catalog compute.
 */
export function runInMemoryPipeline(
  input: InMemoryPipelineRunInput
): InMemoryPipelineRunOutput {
  assertPipelineContextValidInDevelopment(input.context)

  const adapter = input.adapter ?? activityAdapter
  const sourceEvents = input.provider.listEvents()
  let activityInput = adapter.adapt(sourceEvents)
  activityInput = filterInputForEmployeeScope(activityInput, input.context)
  assertActivityInputValidInDevelopment(activityInput)

  const normalized = normalizeActivityInput(activityInput)
  const indicators = stubResolveIndicators(activityInput)

  const built = snapshotEngine.build({
    context: input.context,
    indicators,
    digestItems: toDigestItems(activityInput),
    now: input.now,
  })

  assertBusinessSnapshotValidInDevelopment(built.snapshot)
  assertBusinessDigestValidInDevelopment(built.digest)
  assertExecutiveBriefValidInDevelopment(built.brief)

  const result: PipelineResult = {
    ...built.result,
    metadata: {
      ...built.result.metadata,
      runner: "in-memory-pipeline",
      sprint: "platform-2.0-sprint-7",
      provider: input.provider.name,
      adapterVersion: adapter.version,
      eventCount: activityInput.events.length,
    },
  }

  assertPipelineResultValidInDevelopment(result)

  return {
    activityInput,
    normalized,
    result,
  }
}

/**
 * Sync implementation of IndicatorPipelineRunner for in-memory use.
 * Exposed as async to match the port contract.
 */
export const inMemoryPipelineRunner = {
  async run(
    activityInput: ActivityInput,
    context: PipelineContext
  ): Promise<PipelineResult> {
    const provider: ActivityProvider = {
      name: "InMemoryActivityProvider.fromActivityInput",
      listEvents: () =>
        activityInput.events.map((event) => ({
          id: event.id,
          module: event.module,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          employeeId: event.employeeId,
          createdAt: event.createdAt,
          title: event.title,
          description: event.description,
          metadata: event.metadata,
        })),
    }

    return runInMemoryPipeline({
      context,
      provider,
    }).result
  },
}
