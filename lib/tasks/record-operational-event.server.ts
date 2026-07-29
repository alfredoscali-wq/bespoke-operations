import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { mapTaskOperationalEventInsert } from "@/lib/supabase/operational-control.mapper"
import type { OperationalControlClient } from "@/lib/supabase/operational-control.queries"
import type {
  TaskOperationalEventInsert,
  TaskOperationalEventType,
} from "@/lib/types/operational-control"

/**
 * Persists a durable operational timeline event using the service-role client.
 * Never throws to callers — mutations must not fail because history logging failed.
 * Write-only: no RETURNING/SELECT (callers discard the row).
 */
export async function recordOperationalEventSafe(
  input: TaskOperationalEventInsert,
  client?: ReturnType<typeof createAdminClient>
): Promise<void> {
  try {
    const admin = (client ?? createAdminClient()) as OperationalControlClient
    const { error } = await admin
      .from("task_operational_events")
      .insert(mapTaskOperationalEventInsert(input))

    if (error) {
      console.error(
        "[operational-events] server insert failed",
        input.eventType,
        input.taskId,
        error.message
      )
    }
  } catch (error) {
    console.error(
      "[operational-events] server insert threw",
      input.eventType,
      input.taskId,
      error
    )
  }
}

/** True when this task already has at least one durable event of the given type. */
export async function taskHasOperationalEventType(input: {
  companyId: string
  taskId: string
  eventType: TaskOperationalEventType | string
  client?: ReturnType<typeof createAdminClient>
}): Promise<boolean> {
  try {
    const admin = input.client ?? createAdminClient()
    const { data, error } = await admin
      .from("task_operational_events" as never)
      .select("id")
      .eq("company_id", input.companyId)
      .eq("task_id", input.taskId)
      .eq("event_type", input.eventType)
      .limit(1)

    if (error) {
      console.error(
        "[operational-events] dedupe lookup failed",
        input.eventType,
        error.message
      )
      return false
    }

    return Array.isArray(data) && data.length > 0
  } catch (error) {
    console.error("[operational-events] dedupe lookup threw", error)
    return false
  }
}

export async function recordOperationalEventOnce(input: {
  event: TaskOperationalEventInsert
  perf?: import("@/lib/performance").PerformanceTrace
}): Promise<void> {
  const perf = input.perf
  const admin = createAdminClient()
  const exists = await (perf
    ? perf.span("dedupe", () =>
        taskHasOperationalEventType({
          companyId: input.event.companyId,
          taskId: input.event.taskId,
          eventType: input.event.eventType,
          client: admin,
        })
      )
    : taskHasOperationalEventType({
        companyId: input.event.companyId,
        taskId: input.event.taskId,
        eventType: input.event.eventType,
        client: admin,
      }))
  if (exists) {
    return
  }
  // Single round-trip insert (no RETURNING). Trigger+commit are not separable from JS.
  await (perf
    ? perf.span("insert", () => recordOperationalEventSafe(input.event, admin), {
        detail: "includes trigger+commit",
      })
    : recordOperationalEventSafe(input.event, admin))
}
