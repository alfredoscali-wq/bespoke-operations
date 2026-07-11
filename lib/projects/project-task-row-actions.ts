import { canEditProjectTaskFromObras } from "@/lib/projects/project-start-dispatch"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { canSoftDeleteWorkOrder } from "@/lib/tasks/work-order-deletion-policy"
import type { Task } from "@/lib/types/tasks"

export type ProjectTaskRowActions = {
  showView: boolean
  showEdit: boolean
  showDelete: boolean
  showReviewClosure: boolean
}

export function resolveProjectTaskRowActions(
  task: Pick<Task, "projectId" | "status">
): ProjectTaskRowActions {
  return {
    showView: true,
    showEdit: canEditProjectTaskFromObras(task),
    showDelete: canSoftDeleteWorkOrder(task.status),
    showReviewClosure: isPendingClosureStatus(task.status),
  }
}
