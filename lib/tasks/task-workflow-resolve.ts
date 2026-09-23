import {
  loadLiveCompanyTask,
  type LiveCompanyTaskLookup,
} from "@/lib/tasks/live-company-task"
import {
  canPerformTaskAction,
  getTransitionForAction,
  type TaskWorkflowAction,
} from "@/lib/tasks/task-status-workflow"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export async function resolveTaskForWorkflowAction(
  taskId: string,
  companyId: string,
  options: {
    loadedTask?: Task | null
    listedTask?: Task | null
    loadLiveTask: LiveCompanyTaskLookup
  }
): Promise<{ ok: true; task: Task } | { ok: false; message: string }> {
  return loadLiveCompanyTask(taskId, companyId, {
    loadedTask: options.loadedTask ?? options.listedTask ?? null,
    loadLiveTask: options.loadLiveTask,
  })
}

export function prepareResolvedWorkflowAction(
  task: Task,
  workflowAction: TaskWorkflowAction,
  options?: {
    evidenceCount?: number
    stepPhotoCounts?: Record<string, number>
  }
): { ok: true; to: TaskStatus } | { ok: false; message: string } {
  const validation = canPerformTaskAction(task, workflowAction, options)
  if (!validation.allowed) {
    return {
      ok: false,
      message: validation.message ?? "Transición no permitida.",
    }
  }

  const { to } = getTransitionForAction(workflowAction)
  return { ok: true, to }
}

export async function prepareTaskWorkflowAction(
  taskId: string,
  companyId: string,
  workflowAction: TaskWorkflowAction,
  options: {
    loadedTask?: Task | null
    listedTask?: Task | null
    loadLiveTask: LiveCompanyTaskLookup
    evidenceCount?: number
    stepPhotoCounts?: Record<string, number>
  }
): Promise<
  { ok: true; task: Task; to: TaskStatus } | { ok: false; message: string }
> {
  const resolved = await resolveTaskForWorkflowAction(taskId, companyId, options)
  if (!resolved.ok) {
    return resolved
  }

  const prepared = prepareResolvedWorkflowAction(
    resolved.task,
    workflowAction,
    options
  )
  if (!prepared.ok) {
    return prepared
  }

  return { ok: true, task: resolved.task, to: prepared.to }
}
