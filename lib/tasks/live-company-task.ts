import type { Task } from "@/lib/types/tasks"

export const LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE = "Orden de trabajo no encontrada."

export const TASK_IDENTITY_UNRESOLVED_MESSAGE =
  "No fue posible identificar la orden de trabajo. Actualice e intente nuevamente."

export type LiveCompanyTaskLookup = (
  companyId: string,
  taskId: string
) => Promise<{
  data: Task | null
  error: { code?: string; message: string } | null
}>

export function resolveLoadedLiveCompanyTask<T extends { id: string }>(
  taskId: string,
  loadedTask?: T | null
): T | undefined {
  return loadedTask?.id === taskId ? loadedTask : undefined
}

/**
 * Resolve one live OT by the already-loaded object, otherwise by
 * company_id + task_id + deleted_at IS NULL.
 * Does not consult TasksProvider, fetchTasks, or any capped list.
 */
export async function loadLiveCompanyTask(
  taskId: string,
  companyId: string,
  options: {
    loadedTask?: Task | null
    loadLiveTask: LiveCompanyTaskLookup
  }
): Promise<{ ok: true; task: Task } | { ok: false; message: string }> {
  const fromLoaded = resolveLoadedLiveCompanyTask(taskId, options.loadedTask)
  if (fromLoaded) {
    return { ok: true, task: fromLoaded }
  }

  const trimmedCompanyId = companyId.trim()
  const trimmedTaskId = taskId.trim()
  if (!trimmedCompanyId || !trimmedTaskId) {
    return { ok: false, message: LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE }
  }

  const live = await options.loadLiveTask(trimmedCompanyId, trimmedTaskId)
  if (live.error || !live.data) {
    return { ok: false, message: LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE }
  }

  return { ok: true, task: live.data }
}
