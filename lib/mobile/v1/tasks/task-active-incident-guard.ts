import "server-only"

import { MobileApiError } from "@/lib/mobile/v1/errors"
import {
  isTaskExecutionBlockedByActiveIncident,
  MOBILE_TASK_BLOCKED_BY_ACTIVE_INCIDENT_MESSAGE,
} from "@/lib/mobile/v1/tasks/task-active-incident.shared"
import type { MobileTaskExecutionContext } from "@/lib/mobile/v1/tasks/task-execution-access"
import {
  fetchActiveIncidentTaskIdSet,
  fetchActiveTaskIncidentByTaskId,
} from "@/lib/supabase/task-incidents.queries"
import type { SupabaseTaskIncidentsClient } from "@/lib/supabase/task-incidents.repository"
import type { Task } from "@/lib/types/tasks"

export async function resolveTaskHasActiveIncidentRecord(
  client: SupabaseTaskIncidentsClient,
  taskId: string
): Promise<boolean> {
  const result = await fetchActiveTaskIncidentByTaskId(client, taskId)

  if (result.error) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      "No fue posible validar la incidencia activa de la orden de trabajo.",
      500
    )
  }

  return result.data != null
}

export async function fetchMobileActiveIncidentTaskIdSet(
  client: SupabaseTaskIncidentsClient,
  companyId: string,
  taskIds: string[]
): Promise<Set<string>> {
  const result = await fetchActiveIncidentTaskIdSet(client, companyId, taskIds)

  if (result.error || !result.data) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      "No fue posible validar incidencias activas.",
      500
    )
  }

  return result.data
}

export async function assertMobileTaskExecutionNotBlockedByActiveIncident(
  context: Pick<MobileTaskExecutionContext, "admin" | "task">
): Promise<void> {
  if (context.task.status !== "en-curso") {
    return
  }

  const hasActiveIncident = await resolveTaskHasActiveIncidentRecord(
    context.admin,
    context.task.id
  )

  if (
    isTaskExecutionBlockedByActiveIncident({
      taskStatus: context.task.status,
      hasActiveIncident,
    })
  ) {
    throw new MobileApiError(
      "TASK_BLOCKED_BY_ACTIVE_INCIDENT",
      MOBILE_TASK_BLOCKED_BY_ACTIVE_INCIDENT_MESSAGE,
      409
    )
  }
}

export function resolveMobileHasActiveIncidentForTask(
  task: Pick<Task, "id" | "status">,
  activeIncidentTaskIds: ReadonlySet<string>
): boolean {
  return (
    task.status === "en-curso" && activeIncidentTaskIds.has(task.id)
  )
}
