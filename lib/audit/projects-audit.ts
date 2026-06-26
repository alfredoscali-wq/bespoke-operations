import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import {
  buildAuditChangeMetadata,
  buildAuditFieldChanges,
} from "@/lib/audit/metadata-changes"
import {
  buildProjectStatusMetadata,
  buildProjectStatusMetadataFromTransition,
  resolveProjectEntityLabel,
} from "@/lib/audit/projects-audit-shared"
import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"
import type { Project, ProjectStatus } from "@/lib/types/projects"
import type { UpdateProjectPayload } from "@/lib/types/supabase/projects"

export {
  buildProjectStatusMetadata,
  buildProjectStatusMetadataFromTransition,
  resolveProjectEntityLabel,
} from "@/lib/audit/projects-audit-shared"

const PROJECT_UPDATE_FIELD_LABELS: Partial<Record<keyof UpdateProjectPayload, string>> =
  {
    code: "code",
    name: "name",
    client: "client",
    type: "type",
    location: "location",
    description: "description",
    startDate: "startDate",
    endDate: "endDate",
    supervisor: "supervisor",
  }

const PROJECT_UPDATE_AUDIT_FIELDS = Object.keys(
  PROJECT_UPDATE_FIELD_LABELS
) as (keyof UpdateProjectPayload)[]

const PROJECT_NON_AUDIT_UPDATE_FIELDS = new Set<keyof UpdateProjectPayload>([
  "status",
  "progress",
  "pauseReason",
  "pauseNotes",
  "pausedAt",
  "deletedAt",
])

function buildProjectUpdateChangeMetadata(
  before: Project,
  payload: UpdateProjectPayload
) {
  const fields = PROJECT_UPDATE_AUDIT_FIELDS.filter(
    (field) => payload[field] !== undefined
  )

  const changes = buildAuditFieldChanges({
    before,
    updates: payload as Partial<Record<keyof Project, unknown>>,
    fields: fields as (keyof Project)[],
    labels: PROJECT_UPDATE_FIELD_LABELS as Partial<Record<keyof Project, string>>,
  })

  return buildAuditChangeMetadata(changes)
}

export function isProjectAuditableFieldUpdate(payload: UpdateProjectPayload): boolean {
  return (Object.keys(payload) as (keyof UpdateProjectPayload)[]).some(
    (field) =>
      payload[field] !== undefined && !PROJECT_NON_AUDIT_UPDATE_FIELDS.has(field)
  )
}

export function isProjectStatusUpdate(payload: UpdateProjectPayload): boolean {
  return payload.status !== undefined
}

function recordProjectAuditEvent(input: {
  action:
    | typeof AUDIT_ACTIONS.PROJECT_CREATE
    | typeof AUDIT_ACTIONS.PROJECT_UPDATE
    | typeof AUDIT_ACTIONS.PROJECT_STATUS_CHANGE
    | typeof AUDIT_ACTIONS.PROJECT_ARCHIVE
  project: Pick<Project, "id" | "code" | "name">
  description?: string
  metadata?: Record<string, unknown>
}) {
  const entityLabel = resolveProjectEntityLabel(input.project)

  void recordAuditEventClient({
    module: AUDIT_MODULES.OBRAS,
    action: input.action,
    entityType: AUDIT_ENTITY_TYPES.PROJECT,
    entityId: input.project.id,
    entityLabel,
    description:
      input.description ??
      buildAuditDescription({
        action: input.action,
        entityLabel,
      }),
    metadata: input.metadata,
  })
}

export function recordProjectCreateAudit(project: Project) {
  recordProjectAuditEvent({
    action: AUDIT_ACTIONS.PROJECT_CREATE,
    project,
    metadata: {
      code: project.code,
      status: project.status,
    },
  })
}

export function recordProjectUpdateAudit(
  before: Project,
  payload: UpdateProjectPayload,
  _after: Project
) {
  const changeMetadata = buildProjectUpdateChangeMetadata(before, payload)

  if (changeMetadata.changedFields.length === 0) {
    return
  }

  recordProjectAuditEvent({
    action: AUDIT_ACTIONS.PROJECT_UPDATE,
    project: before,
    metadata: changeMetadata,
  })
}

export function recordProjectStatusChangeAudit(
  before: Pick<Project, "id" | "code" | "name" | "status">,
  after: Pick<Project, "status">
) {
  recordProjectAuditEvent({
    action: AUDIT_ACTIONS.PROJECT_STATUS_CHANGE,
    project: before,
    metadata: buildProjectStatusMetadata(before, after),
  })
}

export function recordProjectStatusChangeAuditFromTransition(input: {
  project: Pick<Project, "id" | "code" | "name">
  previousStatus: ProjectStatus
  nextStatus: ProjectStatus
}) {
  recordProjectAuditEvent({
    action: AUDIT_ACTIONS.PROJECT_STATUS_CHANGE,
    project: input.project,
    metadata: buildProjectStatusMetadataFromTransition(
      input.previousStatus,
      input.nextStatus
    ),
  })
}

export function recordProjectArchiveAudit(
  project: Pick<Project, "id" | "code" | "name" | "status">
) {
  recordProjectAuditEvent({
    action: AUDIT_ACTIONS.PROJECT_ARCHIVE,
    project,
    metadata: {
      archivedAt: new Date().toISOString(),
      status: project.status,
    },
  })
}

/**
 * Reservado para eliminación definitiva server-side (RC futuro).
 */
export function buildProjectDeletePermanentAuditMetadata(
  project: Pick<Project, "code" | "status">
) {
  return {
    code: project.code,
    status: project.status,
  }
}
