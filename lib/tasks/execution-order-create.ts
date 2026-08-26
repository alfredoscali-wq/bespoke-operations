import { occupiesExecutionOrderSlot } from "@/lib/planificacion/planning-operational-order-core"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import { shouldApplyPlanningQueueSideEffectsForTask } from "@/lib/projects/project-start-dispatch"
import { resolveFirstAvailableOperationalOrderSlot } from "@/lib/planificacion/planning-dynamic"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import type { TaskStatus } from "@/lib/types/tasks"

export const TASK_EXECUTION_ORDER_CONFLICT_CODE =
  "TASK_EXECUTION_ORDER_CONFLICT" as const

export const TASK_EXECUTION_ORDER_CONFLICT_MESSAGE =
  "No pudimos asignar el orden de ejecución. Intentá nuevamente."

export type ExecutionOrderCreateCandidate = {
  projectId?: string | null
  projectCode?: string | null
  serviceType?: string | null
  crewId?: string | null
  dueDate?: string | null
  status?: TaskStatus | string | null
}

/**
 * Same gate the create path used before OT 1.1, minus the in-memory slot.
 * Crew + due date + service OT (not Obra) + programada.
 */
export function shouldAssignExecutionOrderOnCreate(
  input: ExecutionOrderCreateCandidate
): boolean {
  const crewId = input.crewId?.trim() || null
  const dueDate = input.dueDate?.trim() || null
  if (!crewId || !dueDate) {
    return false
  }

  if (!shouldApplyPlanningQueueSideEffectsForTask({ projectId: input.projectId })) {
    return false
  }

  if (
    !isWorkOrderTask({
      projectCode: input.projectCode?.trim() || "",
      serviceType: input.serviceType ?? undefined,
    })
  ) {
    return false
  }

  const status = (input.status ?? "programada").trim() || "programada"
  return status === "programada"
}

/** First positive integer not present in occupied execution_order values. */
export function resolveNextExecutionOrderFromOccupied(
  occupiedOrders: Iterable<number>
): number {
  const occupied = new Set<number>()
  for (const value of occupiedOrders) {
    if (Number.isInteger(value) && value > 0) {
      occupied.add(value)
    }
  }
  return resolveFirstAvailableOperationalOrderSlot(occupied)
}

/** Create must never treat a client-calculated order as authoritative. */
export function stripClientExecutionOrder(
  payload: CreateTaskPayload
): CreateTaskPayload {
  const next = { ...payload }
  delete next.executionOrder
  return next
}

export { occupiesExecutionOrderSlot }

/** Persist patch used when an OT becomes vencida. Does not touch dispatch_order. */
export function buildVencidaExecutionOrderReleasePatch(): {
  status: "vencida"
  executionOrder: null
} {
  return { status: "vencida", executionOrder: null }
}

export function applyVencidaExecutionOrderRelease<
  T extends { status: string; executionOrder?: number | null },
>(task: T): T {
  if (task.status !== "vencida") {
    return task
  }

  return { ...task, executionOrder: null }
}

export type ExecutionOrderScopeKey = {
  companyId: string
  crewId: string
  dueDate: string
}

export function executionOrderScopeKey(scope: ExecutionOrderScopeKey): string {
  return `${scope.companyId}:${scope.crewId}:${scope.dueDate}`
}

/**
 * In-memory model of the SQL advisory lock: serialize allocate() per
 * company + crew + due_date, then pick the first free slot.
 */
export function createAtomicExecutionOrderAllocator() {
  const occupiedByScope = new Map<string, Set<number>>()
  const tails = new Map<string, Promise<void>>()

  return {
    async allocate(scope: ExecutionOrderScopeKey): Promise<number> {
      const key = executionOrderScopeKey(scope)
      const previous = tails.get(key) ?? Promise.resolve()
      let assigned = 0
      const run = previous.then(() => {
        const occupied = occupiedByScope.get(key) ?? new Set<number>()
        assigned = resolveNextExecutionOrderFromOccupied(occupied)
        occupied.add(assigned)
        occupiedByScope.set(key, occupied)
        return assigned
      })
      tails.set(
        key,
        run.then(
          () => undefined,
          () => undefined
        )
      )
      return run
    },
  }
}
