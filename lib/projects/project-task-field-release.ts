/**
 * OPS 2.5 — explicit release of Obra OTs to Field Agent (and return before start).
 * programada → asignada (Enviar a Cuadrilla)
 * asignada → programada (Devolver a Obras)
 * Never touches execution_order / dispatch_order.
 */

import {
  LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE,
  loadLiveCompanyTask,
  type LiveCompanyTaskLookup,
} from "@/lib/tasks/live-company-task"
import { canPerformTaskAction } from "@/lib/tasks/task-status-workflow"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export const PROJECT_TASK_NOT_FOUND_MESSAGE = LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE

export type { LiveCompanyTaskLookup }

/**
 * Resolve an Obra OT for Enviar a Cuadrilla / Devolver a Obras from the
 * project tab payload or the already-loaded project task list.
 * Does not consult the global TasksProvider array.
 */
export function resolveProjectFieldDispatchTask<T extends { id: string }>(
  taskId: string,
  options: {
    loadedTask?: T | null
    projectTasks?: readonly T[] | null
  } = {}
): T | undefined {
  if (options.loadedTask?.id === taskId) {
    return options.loadedTask
  }

  return options.projectTasks?.find((item) => item.id === taskId)
}

/**
 * Prefer the OT already loaded for the Obra. If it is not in that context,
 * load the live row by task id + company (deleted rows excluded).
 */
export async function loadProjectFieldDispatchTask(
  taskId: string,
  companyId: string,
  options: {
    loadedTask?: Task | null
    projectTasks?: readonly Task[] | null
    loadLiveTask: LiveCompanyTaskLookup
  }
): Promise<{ ok: true; task: Task } | { ok: false; message: string }> {
  const fromObra = resolveProjectFieldDispatchTask(taskId, options)
  if (fromObra) {
    return { ok: true, task: fromObra }
  }

  return loadLiveCompanyTask(taskId, companyId, {
    loadLiveTask: options.loadLiveTask,
  })
}

export type PreparedProjectTaskFieldDispatch =
  | { ok: true; task: Task; status: TaskStatus }
  | { ok: false; message: string }

async function prepareProjectTaskFieldDispatch(
  taskId: string,
  companyId: string,
  options: {
    loadedTask?: Task | null
    projectTasks?: readonly Task[] | null
    loadLiveTask: LiveCompanyTaskLookup
  },
  mode: "release" | "return"
): Promise<PreparedProjectTaskFieldDispatch> {
  const loaded = await loadProjectFieldDispatchTask(taskId, companyId, options)
  if (!loaded.ok) {
    return loaded
  }

  const transition =
    mode === "release"
      ? releaseProjectTaskToField(loaded.task)
      : returnProjectTaskToPlanning(loaded.task)
  if (!transition.ok) {
    return { ok: false, message: transition.message }
  }

  const action =
    mode === "release" ? "release-obra-to-field" : "return-obra-from-field"
  const validation = canPerformTaskAction(loaded.task, action)
  if (!validation.allowed) {
    return {
      ok: false,
      message: validation.message ?? PROJECT_TASK_NOT_FOUND_MESSAGE,
    }
  }

  return { ok: true, task: loaded.task, status: transition.status }
}

export function prepareProjectTaskFieldRelease(
  taskId: string,
  companyId: string,
  options: {
    loadedTask?: Task | null
    projectTasks?: readonly Task[] | null
    loadLiveTask: LiveCompanyTaskLookup
  }
): Promise<PreparedProjectTaskFieldDispatch> {
  return prepareProjectTaskFieldDispatch(taskId, companyId, options, "release")
}

export function prepareProjectTaskFieldReturn(
  taskId: string,
  companyId: string,
  options: {
    loadedTask?: Task | null
    projectTasks?: readonly Task[] | null
    loadLiveTask: LiveCompanyTaskLookup
  }
): Promise<PreparedProjectTaskFieldDispatch> {
  return prepareProjectTaskFieldDispatch(taskId, companyId, options, "return")
}

export type ProjectTaskFieldReleaseResult =
  | { ok: true; status: TaskStatus }
  | { ok: false; message: string }

function hasCrewAssignment(
  task: Pick<Task, "crewId" | "crew">
): boolean {
  return Boolean(task.crewId?.trim() || task.crew?.trim())
}

export function canReleaseProjectTaskToField(
  task: Pick<Task, "projectId" | "status" | "crewId" | "crew">
): boolean {
  return (
    Boolean(task.projectId?.trim()) &&
    task.status === "programada" &&
    hasCrewAssignment(task)
  )
}

export function canReturnProjectTaskToPlanning(
  task: Pick<Task, "projectId" | "status">
): boolean {
  return Boolean(task.projectId?.trim()) && task.status === "asignada"
}

/**
 * Validates and resolves status for Enviar a Cuadrilla.
 */
export function releaseProjectTaskToField(
  task: Pick<Task, "projectId" | "status" | "crewId" | "crew">
): ProjectTaskFieldReleaseResult {
  if (!task.projectId?.trim()) {
    return {
      ok: false,
      message: "Solo se pueden enviar a campo órdenes de trabajo de una obra.",
    }
  }

  if (task.status !== "programada") {
    return {
      ok: false,
      message:
        "Solo se puede enviar a la cuadrilla una OT en estado Programada.",
    }
  }

  if (!hasCrewAssignment(task)) {
    return {
      ok: false,
      message: "Asigne una cuadrilla antes de enviar la OT a campo.",
    }
  }

  return { ok: true, status: "asignada" }
}

/**
 * Validates and resolves status for Devolver a Obras (solo desde asignada).
 */
export function returnProjectTaskToPlanning(
  task: Pick<Task, "projectId" | "status">
): ProjectTaskFieldReleaseResult {
  if (!task.projectId?.trim()) {
    return {
      ok: false,
      message: "Solo se pueden devolver a Obras órdenes de trabajo de una obra.",
    }
  }

  if (task.status === "en-curso") {
    return {
      ok: false,
      message:
        "No se puede devolver a Obras una OT en curso. Solo aplica mientras esté Asignada.",
    }
  }

  if (task.status === "pendiente-cierre" || task.status === "en-aprobacion") {
    return {
      ok: false,
      message:
        "No se puede devolver a Obras una OT en cierre. Solo aplica mientras esté Asignada.",
    }
  }

  if (task.status === "finalizada" || task.status === "cerrada") {
    return {
      ok: false,
      message: "No se puede devolver a Obras una OT finalizada.",
    }
  }

  if (task.status !== "asignada") {
    return {
      ok: false,
      message:
        "Solo se puede retirar del campo una OT en estado Asignada.",
    }
  }

  return { ok: true, status: "programada" }
}

/** Secondary badge for Obra field-dispatch state. */
export function resolveProjectTaskFieldDispatchBadge(
  task: Pick<Task, "projectId" | "status">
): string | null {
  if (!task.projectId?.trim()) {
    return null
  }

  if (task.status === "programada") {
    return "Pendiente de envío"
  }

  if (task.status === "asignada") {
    return "Enviada a campo"
  }

  return null
}
