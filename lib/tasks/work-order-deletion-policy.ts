import { isTaskArchivedStatus } from "@/lib/tasks/task-archived-status"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { isCancellableTaskStatus } from "@/lib/tasks/status-groups"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export const WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar una orden de trabajo que ya ingresó al circuito operativo."

export const WORK_ORDER_PERMANENT_DELETE_FORBIDDEN_MESSAGE =
  "Solo un administrador del sistema puede eliminar definitivamente una orden de trabajo."

/** Soft delete is allowed only while the OT is still in planning (programada). */
export function canSoftDeleteWorkOrder(status: TaskStatus): boolean {
  return status === "programada"
}

export const WORK_ORDER_PERMANENT_DELETE_ARCHIVED_ONLY_MESSAGE =
  "Solo se pueden eliminar definitivamente órdenes de trabajo del Archivo OT."

export function canPermanentlyDeleteWorkOrder(
  systemRole: string | null | undefined,
  status: TaskStatus
): boolean {
  return systemRole === "administrador" && isTaskArchivedStatus(status)
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
  task: Pick<Task, "status">
): WorkOrderRowMenuPolicy {
  const { status } = task

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
      showSoftDelete: false,
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
    showSoftDelete: canSoftDeleteWorkOrder(status),
    showCancel: false,
    showReopenPlanning: false,
    showAssignCrew: true,
    showChangeStatus: false,
  }
}
