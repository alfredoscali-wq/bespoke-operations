import "server-only"

import { toLocalDateOnly } from "@/lib/dates/date-only"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { fetchTodayAgendaTasks } from "@/lib/mobile/v1/agenda/agenda-queries"
import { sortAgendaTasks } from "@/lib/mobile/v1/agenda/sort-agenda-tasks"
import type {
  MobileAgendaTaskItem,
  MobileAgendaTodayResponse,
} from "@/lib/mobile/v1/agenda/types"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import {
  fetchMobileActiveIncidentTaskIdSet,
  resolveMobileHasActiveIncidentForTask,
} from "@/lib/mobile/v1/tasks/task-active-incident-guard"
import { resolveDispatchOperationalOrder } from "@/lib/planificacion/planning-operational-order-core"
import { resolveTaskOperationalTitle } from "@/lib/tasks/work-order"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Task } from "@/lib/types/tasks"
import { fetchActiveWorkTeamShift } from "@/lib/work-team-shifts/work-team-shifts.queries"

function summarizeObservations(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.length <= 160) {
    return trimmed
  }

  return `${trimmed.slice(0, 157)}...`
}

function mapTaskToAgendaItem(
  task: Task,
  activeIncidentTaskIds: ReadonlySet<string>
): MobileAgendaTaskItem {
  const customerOrAssetName =
    task.customerName?.trim() || task.projectName?.trim() || "—"

  return {
    id: task.id,
    workOrderNumber: task.workOrderNumber?.trim() || task.code?.trim() || null,
    workType: resolveTaskOperationalTitle(task),
    taskType: task.type,
    status: task.status,
    priority: task.priority,
    date: task.dueDate,
    scheduledTime: task.scheduledTime?.trim() || null,
    customerOrAssetName,
    address: task.serviceAddress?.trim() || "—",
    locality: task.locality?.trim() || null,
    summaryObservations: summarizeObservations(task.observationsForCrew),
    amountToCollect:
      task.amountToCollect == null ? null : Number(task.amountToCollect),
    latitude: task.latitude ?? null,
    longitude: task.longitude ?? null,
    executionOrder: resolveDispatchOperationalOrder(task),
    dispatchOrder: task.dispatchOrder ?? null,
    hasActiveIncident: resolveMobileHasActiveIncidentForTask(
      task,
      activeIncidentTaskIds
    ),
  }
}

export async function getMobileAgendaToday(
  auth: MobileAuthContext,
  deviceId: string
): Promise<MobileAgendaTodayResponse> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, deviceId)
  const activeShift = await fetchActiveWorkTeamShift(
    admin,
    auth.companyId,
    resolved.workTeamId
  )

  if (!activeShift) {
    return {
      shiftActive: false,
      workTeamId: resolved.workTeamId,
      workTeamName: resolved.workTeamName,
      items: [],
    }
  }

  const today = toLocalDateOnly()
  const tasks = await fetchTodayAgendaTasks(
    admin,
    auth.companyId,
    resolved.workTeamId,
    resolved.workTeamName,
    today
  )

  const sortedTasks = sortAgendaTasks(tasks)
  const activeIncidentTaskIds = await fetchMobileActiveIncidentTaskIdSet(
    admin,
    auth.companyId,
    sortedTasks.map((task) => task.id)
  )

  return {
    shiftActive: true,
    workTeamId: resolved.workTeamId,
    workTeamName: resolved.workTeamName,
    items: sortedTasks.map((task) =>
      mapTaskToAgendaItem(task, activeIncidentTaskIds)
    ),
  }
}

export function validateMobileAgendaTodayQuery(deviceId: string | null): {
  deviceId: string
} {
  if (!deviceId?.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Parámetro requerido: deviceId.",
      400
    )
  }

  return { deviceId: deviceId.trim() }
}
