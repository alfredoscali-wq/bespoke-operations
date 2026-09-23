import type { Task } from "@/lib/types/tasks"
import { matchesActiveWorkOrderListQuery } from "@/lib/tasks/task-list-scope"

export type TaskDetailPageAccess =
  | { outcome: "loading" }
  | { outcome: "not-found" }
  | { outcome: "show"; task: Task }

/**
 * Direct /tareas/[id] access. Prefer the current module list when the OT is
 * already there; otherwise use a punctual live row. Membership in
 * activeWorkOrders is not required.
 */
export function resolveTaskDetailPageAccess(input: {
  listedTask?: Task | null
  fetchedTask?: Task | null
  isListReady: boolean
  isAuthReady: boolean
  isFetching: boolean
  requireArchived: boolean
  archiveFetchState: "idle" | "loading" | "missing"
}): TaskDetailPageAccess {
  if (input.listedTask) {
    return { outcome: "show", task: input.listedTask }
  }

  if (input.requireArchived) {
    if (input.archiveFetchState === "loading" || input.archiveFetchState === "idle") {
      return { outcome: "loading" }
    }

    if (input.fetchedTask) {
      return { outcome: "show", task: input.fetchedTask }
    }

    return { outcome: "not-found" }
  }

  if (input.fetchedTask) {
    return { outcome: "show", task: input.fetchedTask }
  }

  if (!input.isListReady || !input.isAuthReady || input.isFetching) {
    return { outcome: "loading" }
  }

  return { outcome: "not-found" }
}

export function shouldFetchLiveTaskForDetailPage(input: {
  listedTask?: Task | null
  requireArchived: boolean
  isListReady: boolean
  isAuthReady: boolean
}): boolean {
  return (
    !input.requireArchived &&
    !input.listedTask &&
    input.isListReady &&
    input.isAuthReady
  )
}

/** Active /tareas list semantics — Obra OTs stay excluded from that list. */
export function isTaskInActiveWorkOrderList(task: {
  status: Task["status"]
  projectId?: string | null
  deletedAt?: string | null
}): boolean {
  return matchesActiveWorkOrderListQuery(task)
}
