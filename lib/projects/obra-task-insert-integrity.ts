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

export type ObraTaskInsertIntegrityResult =
  | { ok: true; status: TaskStatus }
  | { ok: false; message: string }

/**
 * Mirror of enforce_task_status_workflow INSERT rules after OBRAS OPS 1.0 hotfix.
 * Authoritative enforcement remains in DB: active Obra forces status=asignada.
 */
export function validateObraTaskInsertIntegrity(input: {
  task: ObraTaskInsertCandidate
  project?: ObraInsertProjectRef | null
  crew?: ObraInsertCrewRef | null
}): ObraTaskInsertIntegrityResult {
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

  if (task.projectId) {
    if (
      !project ||
      project.id !== task.projectId ||
      project.companyId !== task.companyId ||
      Boolean(project.deletedAt)
    ) {
      return {
        ok: false,
        message:
          "La obra no existe, está eliminada o no pertenece al mismo tenant.",
      }
    }

    // Hotfix: projects.status is source of truth for active Obras.
    if (project.status === "active") {
      return { ok: true, status: "asignada" }
    }

    if (task.status === "asignada") {
      return {
        ok: false,
        message:
          "Solo se pueden crear tareas asignadas en una obra activa del mismo tenant.",
      }
    }

    if (task.status !== "programada") {
      return {
        ok: false,
        message:
          "Las órdenes de trabajo nuevas deben crearse en estado programada.",
      }
    }

    return { ok: true, status: "programada" }
  }

  if (task.status !== "programada") {
    return {
      ok: false,
      message:
        "Las órdenes de trabajo nuevas deben crearse en estado programada.",
    }
  }

  return { ok: true, status: "programada" }
}

/** Module key for Obras in APP_MODULE_KEYS is "projects". */
export function canAccessObrasModuleForStart(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "projects")
}
