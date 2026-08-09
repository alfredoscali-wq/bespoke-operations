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
 * Mirror of enforce_task_status_workflow INSERT rules after OBRAS OPS 2.0.
 * Authoritative enforcement remains in DB:
 *   - planned Obra → borrador
 *   - active Obra → programada (universo Planificación)
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

    if (project.status === "active") {
      return { ok: true, status: "programada" }
    }

    return { ok: true, status: "borrador" }
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

/** OBRAS OPS 1.2: mismo gate de módulo que iniciar obra. */
export const canAccessObrasModuleForFinalize = canAccessObrasModuleForStart
