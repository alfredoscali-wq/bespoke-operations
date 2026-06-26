import type { Project, ProjectStatus } from "@/lib/types/projects"

export function resolveProjectEntityLabel(
  project: Pick<Project, "code" | "name" | "id">
) {
  return project.code?.trim() || project.name?.trim() || project.id
}

export function buildProjectStatusMetadata(
  before: Pick<Project, "status">,
  after: Pick<Project, "status">
) {
  return {
    estado_anterior: before.status,
    estado_nuevo: after.status,
  }
}

export function buildProjectStatusMetadataFromTransition(
  previousStatus: ProjectStatus,
  nextStatus: ProjectStatus
) {
  return buildProjectStatusMetadata(
    { status: previousStatus },
    { status: nextStatus }
  )
}
