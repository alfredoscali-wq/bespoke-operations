/**
 * OPS 2.5 — explicit release of Obra OTs to Field Agent (and return before start).
 * programada → asignada (Enviar a Cuadrilla)
 * asignada → programada (Devolver a Obras)
 * Never touches execution_order / dispatch_order.
 */

import type { Task, TaskStatus } from "@/lib/types/tasks"

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
