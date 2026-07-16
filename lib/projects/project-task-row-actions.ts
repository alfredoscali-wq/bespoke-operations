import { canEditProjectTaskFromObras } from "@/lib/projects/project-start-dispatch"
import { canRescheduleProjectTask } from "@/lib/projects/project-task-reschedule"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { canSoftDeleteWorkOrder } from "@/lib/tasks/work-order-deletion-policy"
import type { Task } from "@/lib/types/tasks"

export type ProjectTaskRowActions = {
  showView: boolean
  showEdit: boolean
  showDelete: boolean
  showReviewClosure: boolean
  showReschedule: boolean
}

export function resolveProjectTaskRowActions(
  task: Pick<
    Task,
    | "projectId"
    | "status"
    | "progress"
    | "completedAt"
    | "closedAt"
    | "operationalSteps"
  >
): ProjectTaskRowActions {
  return {
    showView: true,
    showEdit: canEditProjectTaskFromObras(task),
    showDelete: canSoftDeleteWorkOrder(task),
    showReviewClosure: isPendingClosureStatus(task.status),
    showReschedule: canRescheduleProjectTask(task),
  }
}
