import type { ProjectStatus } from "@/lib/types/projects"
import type { TaskStatus } from "@/lib/types/tasks"
import type { SessionUser } from "@/lib/auth/types"
import { hasWebModuleAccess } from "@/lib/roles/web-module-access"

export type ObraInsertProjectRef = {
  id: string
  companyId: string
  status: ProjectStatus
  deletedAt?: string | null
}

export type ObraInsertCrewRef = {
  id: string
  companyId: string
  deletedAt?: string | null
}

export type ObraTaskInsertCandidate = {
  companyId: string
  projectId: string | null | undefined
  crewId?: string | null
  status: TaskStatus
}

/**
 * Mirror of DB trigger rules for Obra task INSERT hardening (OBRAS OPS 1.0).
 * Authoritative enforcement remains in enforce_task_status_workflow.
 */
export function validateObraTaskInsertIntegrity(input: {
  task: ObraTaskInsertCandidate
  project?: ObraInsertProjectRef | null
  crew?: ObraInsertCrewRef | null
}): { ok: true } | { ok: false; message: string } {
  const { task, project, crew } = input

  if (task.projectId && task.crewId) {
    if (
      !crew ||
      crew.id !== task.crewId ||
      crew.companyId !== task.companyId ||
      Boolean(crew.deletedAt)
    ) {
      return {
        ok: false,
        message:
          "La cuadrilla no pertenece a la compañía de la tarea o está archivada.",
      }
    }
  }

  if (task.status === "asignada" && task.projectId) {
    if (
      !project ||
      project.id !== task.projectId ||
      project.companyId !== task.companyId ||
      Boolean(project.deletedAt) ||
      project.status !== "active"
    ) {
      return {
        ok: false,
        message:
          "Solo se pueden crear tareas asignadas en una obra activa del mismo tenant.",
      }
    }

    return { ok: true }
  }

  if (task.status !== "programada") {
    return {
      ok: false,
      message:
        "Las órdenes de trabajo nuevas deben crearse en estado programada.",
    }
  }

  return { ok: true }
}

/** Module key for Obras in APP_MODULE_KEYS is "projects". */
export function canAccessObrasModuleForStart(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "projects")
}
