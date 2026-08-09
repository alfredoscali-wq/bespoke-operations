import type { ProjectStatus } from "@/lib/types/projects"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import {
  hasProjectGps,
  PROJECT_GPS_REQUIRED_TO_START_MESSAGE,
} from "@/lib/projects/project-gps"

export type ProjectStartDispatchTask = Pick<
  Task,
  "id" | "code" | "status" | "crewId" | "dueDate" | "projectId"
>

export type ProjectStartDispatchValidation =
  | { ok: true; dispatchableTasks: ProjectStartDispatchTask[] }
  | { ok: false; message: string }

function hasCrew(task: ProjectStartDispatchTask): boolean {
  return Boolean(task.crewId?.trim())
}

function hasDueDate(task: ProjectStartDispatchTask): boolean {
  return Boolean(task.dueDate?.trim())
}

/** Client-side mirror of start_project_operational_dispatch preconditions (OPS 2.0). */
export function validateStartProjectDispatch(input: {
  projectStatus: ProjectStatus
  tasks: ProjectStartDispatchTask[]
  latitude?: number | null
  longitude?: number | null
}): ProjectStartDispatchValidation {
  if (input.projectStatus !== "planned") {
    return {
      ok: false,
      message: "Solo se puede iniciar una obra en estado Planificada.",
    }
  }

  if (
    !hasProjectGps({
      latitude: input.latitude,
      longitude: input.longitude,
    })
  ) {
    return {
      ok: false,
      message: PROJECT_GPS_REQUIRED_TO_START_MESSAGE,
    }
  }

  const activeTasks = input.tasks.filter((task) => Boolean(task.id))

  if (activeTasks.length === 0) {
    return {
      ok: false,
      message:
        "La obra no tiene tareas. Cree al menos una tarea antes de iniciarla.",
    }
  }

  const borradorTasks = activeTasks.filter(
    (task) => task.status === "borrador"
  )

  const missingCrew = borradorTasks.filter((task) => !hasCrew(task))
  if (missingCrew.length > 0) {
    const codes = missingCrew.map((task) => task.code).join(", ")
    return {
      ok: false,
      message: `Hay tareas sin cuadrilla asignada (${codes}). Asigne cuadrilla antes de iniciar la obra.`,
    }
  }

  const missingDate = borradorTasks.filter((task) => !hasDueDate(task))
  if (missingDate.length > 0) {
    const codes = missingDate.map((task) => task.code).join(", ")
    return {
      ok: false,
      message: `Hay tareas sin fecha operativa (${codes}). Defina la fecha antes de iniciar la obra.`,
    }
  }

  const dispatchableTasks = borradorTasks.filter(
    (task) => hasCrew(task) && hasDueDate(task)
  )

  return { ok: true, dispatchableTasks }
}

export function buildStartProjectDispatchHistoryDescription(
  dispatchedCount: number
): string {
  if (dispatchedCount === 1) {
    return "Estado actualizado de Planificada a Activa. Despacho operativo: 1 tarea pasó a Programada e ingresó a Planificación."
  }

  return `Estado actualizado de Planificada a Activa. Despacho operativo: ${dispatchedCount} tareas pasaron a Programada e ingresaron a Planificación.`
}

export type StartProjectDispatchResult = {
  projectId: string
  previousStatus: "planned"
  nextStatus: "active"
  dispatchedCount: number
  dispatchedTaskIds: string[]
}

export function parseStartProjectDispatchRpcResult(
  data: unknown
): StartProjectDispatchResult | null {
  if (!data || typeof data !== "object") return null

  const row = data as Record<string, unknown>
  const projectId = typeof row.project_id === "string" ? row.project_id : null
  const dispatchedCount =
    typeof row.dispatched_count === "number" ? row.dispatched_count : null
  const rawIds = row.dispatched_task_ids

  const dispatchedTaskIds = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === "string")
    : []

  if (!projectId || dispatchedCount == null) return null

  return {
    projectId,
    previousStatus: "planned",
    nextStatus: "active",
    dispatchedCount,
    dispatchedTaskIds,
  }
}

/** Statuses that remain freely editable from the Obras module (OPS 2.2). */
const OBRAS_EDITABLE_TASK_STATUSES: TaskStatus[] = [
  "borrador",
  "programada",
  "asignada",
  "en-curso",
]

/**
 * Obra tasks (project_id set) may be edited from Obras while
 * borrador / programada / asignada / en-curso (OPS 2.2 supervised edit).
 * Does not touch status, dispatch_order, or execution_order.
 */
export function canEditProjectTaskFromObras(
  task: Pick<Task, "projectId" | "status">
): boolean {
  if (!task.projectId) return false
  return OBRAS_EDITABLE_TASK_STATUSES.includes(task.status)
}

/**
 * OPS 2.0 create status:
 * - Obra no iniciada → borrador (fuera de Planificación / Mobile)
 * - Obra active → programada (entra directo al universo de Planificación)
 */
export function resolveProjectTaskCreateStatus(
  projectStatus: ProjectStatus
): TaskStatus {
  return projectStatus === "active" ? "programada" : "borrador"
}

/**
 * Planning queue side-effects (execution_order):
 * - OT de servicio: sí
 * - OT de Obra (projectId): nunca (OPS 2.1B — fuera de ruta)
 */
export function shouldApplyPlanningQueueSideEffectsForTask(
  task:
    | Pick<Task, "projectId" | "status">
    | { projectId?: string | null; status?: TaskStatus | null }
): boolean {
  return !task.projectId
}
