import "server-only"

import { toLocalDateOnly } from "@/lib/dates/date-only"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import { fetchActiveWorkTeamShift } from "@/lib/work-team-shifts/work-team-shifts.queries"
import type { SupabaseClient } from "@supabase/supabase-js"

type AdminClient = SupabaseClient

export type MobileTaskExecutionContext = {
  admin: AdminClient
  auth: MobileAuthContext
  task: Task
  workTeamId: string
  workTeamName: string
  mobileDeviceId: string
}

async function fetchTaskForCompany(
  client: AdminClient,
  companyId: string,
  taskId: string
): Promise<Task | null> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapTaskRowToTask(data) : null
}

export async function assertMobileTaskExecutionAccess(
  auth: MobileAuthContext,
  taskId: string,
  deviceId: string,
  options?: {
    allowedStatuses?: TaskStatus[]
    requireActiveShift?: boolean
  }
): Promise<MobileTaskExecutionContext> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, deviceId)
  const requireActiveShift = options?.requireActiveShift ?? true

  if (requireActiveShift) {
    const activeShift = await fetchActiveWorkTeamShift(
      admin,
      auth.companyId,
      resolved.workTeamId
    )

    if (!activeShift) {
      throw new MobileApiError(
        "SHIFT_NOT_ACTIVE",
        "No hay jornada activa.",
        409
      )
    }
  }

  const task = await fetchTaskForCompany(admin, auth.companyId, taskId)

  if (!task) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const crewRef = {
    id: resolved.workTeamId,
    name: resolved.workTeamName,
  }

  if (!taskMatchesCrewId(task, crewRef) || task.dueDate !== toLocalDateOnly()) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const allowedStatuses = options?.allowedStatuses

  if (allowedStatuses && !allowedStatuses.includes(task.status)) {
    throw new MobileApiError(
      "TASK_INVALID_STATUS",
      "La orden de trabajo no admite esta acción en su estado actual.",
      409
    )
  }

  return {
    admin,
    auth,
    task,
    workTeamId: resolved.workTeamId,
    workTeamName: resolved.workTeamName,
    mobileDeviceId: resolved.mobileDevice.id,
  }
}
