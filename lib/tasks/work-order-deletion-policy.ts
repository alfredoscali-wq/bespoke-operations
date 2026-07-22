import { isTaskArchivedStatus } from "@/lib/tasks/task-archived-status"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { isCancellableTaskStatus } from "@/lib/tasks/status-groups"
import { isArchiveWorkOrderStatus } from "@/lib/tasks/task-list-scope"
import { hasActivePlanningReturn } from "@/lib/tasks/planning-return"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export const WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar una orden de trabajo que ya ingresó al circuito operativo."

export const WORK_ORDER_PLANNING_RETURN_DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar una orden de trabajo devuelta por planificación. Reprográmela o gestónela desde el KPI Devueltas."

export const WORK_ORDER_PERMANENT_DELETE_FORBIDDEN_MESSAGE =
  "Solo un administrador del sistema puede eliminar definitivamente una orden de trabajo."

/** Snapshot used by soft-delete gates (UI + repository). */
export type SoftDeleteWorkOrderCandidate = Pick<Task, "status"> &
  Partial<
    Pick<
      Task,
      | "projectId"
      | "progress"
      | "completedAt"
      | "closedAt"
      | "operationalSteps"
      | "taskMetadata"
    >
  >

function hasUnstartedProjectAssignmentSignals(
  task: SoftDeleteWorkOrderCandidate
): boolean {
  if (task.completedAt || task.closedAt) {
    return false
  }

  if ((task.progress ?? 0) > 0) {
    return false
  }

  if (task.operationalSteps?.some((step) => Boolean(step.completedAt))) {
    return false
  }

  return true
}

/**
 * OTs created under an Obra activa start as `asignada` before field work begins.
 * Soft-delete is allowed only while they remain unstarted.
 */
export function canSoftDeleteUnstartedProjectAssignment(
  task: SoftDeleteWorkOrderCandidate
): boolean {
  if (task.status !== "asignada") {
    return false
  }

  if (!task.projectId?.trim()) {
    return false
  }

  return hasUnstartedProjectAssignmentSignals(task)
}

/**
 * Soft delete is allowed while the OT is still in planning (`programada`), or for
 * unstarted Obra assignments (`asignada` + projectId, never started).
 *
 * OT con devolución activa por Planificación no se eliminan (KPI Devueltas).
 *
 * Passing only a status string keeps the legacy contract: only `programada`.
 */
export function canSoftDeleteWorkOrder(
  input: TaskStatus | SoftDeleteWorkOrderCandidate
): boolean {
  if (typeof input === "string") {
    return input === "programada"
  }

  if (hasActivePlanningReturn(input)) {
    return false
  }

  if (input.status === "programada") {
    return true
  }

  return canSoftDeleteUnstartedProjectAssignment(input)
}

/**
 * Admin soft-delete statuses (reuses deleted_at).
 * Includes planning, unstarted Obra assignments, and Archivo OT.
 */
export function canAdminSoftDeleteWorkOrder(
  input: TaskStatus | SoftDeleteWorkOrderCandidate
): boolean {
  if (typeof input === "string") {
    return input === "programada" || isArchiveWorkOrderStatus(input)
  }

  return (
    canSoftDeleteWorkOrder(input) || isArchiveWorkOrderStatus(input.status)
  )
}

export const WORK_ORDER_PERMANENT_DELETE_ARCHIVED_ONLY_MESSAGE =
  "Solo se pueden eliminar definitivamente órdenes de trabajo del Archivo OT."

export function canPermanentlyDeleteWorkOrder(
  systemRole: string | null | undefined,
  status: TaskStatus
): boolean {
  return systemRole === "administrador" && isTaskArchivedStatus(status)
}

/** Admin-only "Eliminar definitivamente" in Archivo OT (incl. canceladas). */
export function canShowAdminSoftDeleteInArchive(
  systemRole: string | null | undefined,
  status: TaskStatus
): boolean {
  return systemRole === "administrador" && isArchiveWorkOrderStatus(status)
}

export type WorkOrderRowMenuPolicy = {
  showView: boolean
  viewLabel: "Ver" | "Ver detalle" | "Revisar" | "Gestionar incidencia"
  showEdit: boolean
  showSoftDelete: boolean
  showCancel: boolean
  showReopenPlanning: boolean
  showAssignCrew: boolean
  showChangeStatus: boolean
}

export function resolveWorkOrderRowMenuPolicy(
  task: SoftDeleteWorkOrderCandidate
): WorkOrderRowMenuPolicy {
  const { status } = task

  if (hasActivePlanningReturn(task)) {
    return {
      showView: true,
      viewLabel: "Ver detalle",
      showEdit: false,
      showSoftDelete: false,
      showCancel: false,
      showReopenPlanning: false,
      showAssignCrew: false,
      showChangeStatus: false,
    }
  }

  if (isTaskArchivedStatus(status) || status === "cancelada") {
    return {
      showView: true,
      viewLabel: "Ver detalle",
      showEdit: false,
      showSoftDelete: false,
      showCancel: false,
      showReopenPlanning: false,
      showAssignCrew: false,
      showChangeStatus: false,
    }
  }

  if (isPendingClosureStatus(status)) {
    return {
      showView: true,
      viewLabel: "Revisar",
      showEdit: false,
      showSoftDelete: false,
      showCancel: false,
      showReopenPlanning: false,
      showAssignCrew: false,
      showChangeStatus: false,
    }
  }

  if (status === "en-curso" || status === "incidencia") {
    return {
      showView: true,
      viewLabel: "Gestionar incidencia",
      showEdit: false,
      showSoftDelete: false,
      showCancel: false,
      showReopenPlanning: false,
      showAssignCrew: false,
      showChangeStatus: false,
    }
  }

  if (status === "asignada" || status === "vencida") {
    return {
      showView: true,
      viewLabel: "Ver",
      showEdit: false,
      showSoftDelete: canSoftDeleteWorkOrder(task),
      showCancel: isCancellableTaskStatus(status),
      showReopenPlanning: status === "asignada",
      showAssignCrew: false,
      showChangeStatus: false,
    }
  }

  return {
    showView: true,
    viewLabel: "Ver",
    showEdit: true,
    showSoftDelete: canSoftDeleteWorkOrder(task),
    showCancel: false,
    showReopenPlanning: false,
    showAssignCrew: true,
    showChangeStatus: false,
  }
}
