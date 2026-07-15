import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  insertTaskOperationalEvent,
  type OperationalControlClient,
} from "@/lib/supabase/operational-control.queries"
import type {
  TaskOperationalEventInsert,
  TaskOperationalEventType,
} from "@/lib/types/operational-control"

/**
 * Persists a durable operational timeline event using the service-role client.
 * Never throws to callers — mutations must not fail because history logging failed.
 */
export async function recordOperationalEventSafe(
  input: TaskOperationalEventInsert
): Promise<void> {
  try {
    const result = await insertTaskOperationalEvent(
      createAdminClient() as unknown as OperationalControlClient,
      input
    )
    if (result.error) {
      console.error(
        "[operational-events] server insert failed",
        input.eventType,
        input.taskId,
        result.error.message
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
}): Promise<boolean> {
  try {
    const admin = createAdminClient()
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
}): Promise<void> {
  const exists = await taskHasOperationalEventType({
    companyId: input.event.companyId,
    taskId: input.event.taskId,
    eventType: input.event.eventType,
  })
  if (exists) {
    return
  }
  await recordOperationalEventSafe(input.event)
}
