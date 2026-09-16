import "server-only"

import { toLocalDateOnly } from "@/lib/dates/date-only"
import { fetchTodayAgendaTasks } from "@/lib/mobile/v1/agenda/agenda-queries"
import { isFieldAgentAgendaTaskVisible } from "@/lib/mobile/v1/agenda/agenda-task-visibility"
import { sortAgendaTasks } from "@/lib/mobile/v1/agenda/sort-agenda-tasks"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import {
  mergeChecklistWithResponses,
  readOperationalChecklistResponses,
  fetchOperationalChecklistTemplateForTask,
} from "@/lib/mobile/v1/tasks/checklist-execution"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { resolveMobileTaskHasActiveIncident } from "@/lib/mobile/v1/tasks/task-active-incident.shared"
import {
  resolveTaskHasActiveIncidentRecord,
} from "@/lib/mobile/v1/tasks/task-active-incident-guard"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import {
  mapMobileTaskDetailResponse,
  mapMobileTaskNextWorkItem,
  mapMobileTaskReferencePhotos,
} from "@/lib/mobile/v1/tasks/task-detail-mapper"
import { fetchProjectGpsForCompany } from "@/lib/mobile/v1/tasks/resolve-task-start-coordinates"
import type {
  MobileTaskDetailResponse,
} from "@/lib/mobile/v1/tasks/types"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchTaskReferencePhotos } from "@/lib/supabase/task-photos.queries"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import type { Task } from "@/lib/types/tasks"
import { fetchActiveWorkTeamShift } from "@/lib/work-team-shifts/work-team-shifts.queries"
import type { SupabaseClient } from "@supabase/supabase-js"

async function fetchTaskForCompany(
  client: SupabaseClient,
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

export async function getMobileTaskDetail(
  auth: MobileAuthContext,
  taskId: string,
  deviceId: string
): Promise<MobileTaskDetailResponse> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, deviceId)

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

  if (!taskMatchesCrewId(task, crewRef)) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const today = toLocalDateOnly()

  if (!isFieldAgentAgendaTaskVisible(task, today)) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const agendaTasks = sortAgendaTasks(
    await fetchTodayAgendaTasks(
      admin,
      auth.companyId,
      resolved.workTeamId,
      resolved.workTeamName,
      today
    )
  )

  const currentIndex = agendaTasks.findIndex((item) => item.id === task.id)
  const nextTask =
    currentIndex >= 0 ? agendaTasks[currentIndex + 1] : undefined

  const operationalChecklistTemplate =
    await fetchOperationalChecklistTemplateForTask(admin, auth.companyId, task)

  const checklist =
    task.status === "en-curso"
      ? mergeChecklistWithResponses(
          operationalChecklistTemplate,
          readOperationalChecklistResponses(task)
        )
      : []

  const referencePhotosResult = await fetchTaskReferencePhotos(admin, task.id)
  const referencePhotos = referencePhotosResult.error
    ? []
    : mapMobileTaskReferencePhotos(referencePhotosResult.data)

  const hasActiveIncidentRecord = await resolveTaskHasActiveIncidentRecord(
    admin,
    task.id
  )
  const hasActiveIncident = resolveMobileTaskHasActiveIncident({
    taskStatus: task.status,
    hasActiveIncidentRecord,
  })

  const projectGps = task.projectId
    ? await fetchProjectGpsForCompany(admin, auth.companyId, task.projectId)
    : null

  return mapMobileTaskDetailResponse(
    task,
    mapMobileTaskNextWorkItem(nextTask),
    checklist,
    referencePhotos,
    hasActiveIncident,
    projectGps
  )
}

export function validateMobileTaskDetailRequest(
  taskId: string,
  deviceId: string | null
): { taskId: string; deviceId: string } {
  if (!taskId.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Identificador de trabajo inválido.",
      400
    )
  }

  if (!deviceId?.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Parámetro requerido: deviceId.",
      400
    )
  }

  return {
    taskId: taskId.trim(),
    deviceId: deviceId.trim(),
  }
}
