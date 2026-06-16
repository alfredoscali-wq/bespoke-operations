import type { UpdateProjectPayload } from "@/lib/types/supabase/projects"
import type {
  PauseProjectInput,
  Project,
  ProjectHistoryEvent,
  ProjectHistoryEventType,
  ProjectPauseReason,
  ProjectStatus,
} from "@/lib/types/projects"
import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import {
  buildPauseHistoryDescription,
  getHistoryTitleForEvent,
} from "@/lib/projects/utils"

const DEFAULT_USER = "Coordinación operativa"

export function createHistoryEvent(input: {
  eventType: ProjectHistoryEventType
  description: string
  user?: string
  metadata?: Record<string, string>
}): ProjectHistoryEvent {
  return {
    id: crypto.randomUUID(),
    eventType: input.eventType,
    title: getHistoryTitleForEvent(input.eventType),
    description: input.description,
    user: input.user ?? DEFAULT_USER,
    timestamp: new Date().toISOString(),
    metadata: input.metadata,
  }
}

export function buildStatusChangeHistory(
  previousStatus: ProjectStatus,
  nextStatus: ProjectStatus
): ProjectHistoryEvent {
  return createHistoryEvent({
    eventType: "status_changed",
    description: `Estado actualizado de ${PROJECT_STATUS_LABELS[previousStatus]} a ${PROJECT_STATUS_LABELS[nextStatus]}.`,
    metadata: {
      previousStatus,
      nextStatus,
    },
  })
}

export function buildPauseHistory(input: PauseProjectInput): ProjectHistoryEvent {
  return createHistoryEvent({
    eventType: "paused",
    description: buildPauseHistoryDescription(input),
    metadata: {
      reason: input.reason,
      notes: input.notes ?? "",
    },
  })
}

export function buildProjectUpdatePayloadForPause(
  input: PauseProjectInput
): UpdateProjectPayload {
  return {
    status: "paused",
    pauseReason: input.reason,
    pauseNotes: input.notes?.trim() || null,
    pausedAt: new Date().toISOString(),
  }
}

export function buildProjectUpdatePayloadForResume(): UpdateProjectPayload {
  return {
    status: "active",
    pauseReason: null,
    pauseNotes: null,
    pausedAt: null,
  }
}

export function appendHistoryEvent(
  history: ProjectHistoryEvent[],
  event: ProjectHistoryEvent
): ProjectHistoryEvent[] {
  return [event, ...history]
}

export function mergeProjectPauseFields(
  project: Project,
  payload: UpdateProjectPayload
): Project {
  return {
    ...project,
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.pauseReason !== undefined
      ? {
          pauseReason: (payload.pauseReason ?? undefined) as
            | ProjectPauseReason
            | undefined,
        }
      : {}),
    ...(payload.pauseNotes !== undefined
      ? { pauseNotes: payload.pauseNotes ?? undefined }
      : {}),
    ...(payload.pausedAt !== undefined
      ? { pausedAt: payload.pausedAt ?? undefined }
      : {}),
  }
}
