import "server-only"

import { recordTaskMobileStartAudit } from "@/lib/audit/tasks-audit.server"
import { toLocalDateOnly } from "@/lib/dates/date-only"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { fetchOperationalChecklistForServiceType } from "@/lib/mobile/v1/checklist/checklist-queries"
import type { MobileOperationalChecklistItem } from "@/lib/mobile/v1/checklist/types"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import {
  calculateDistanceMeters,
  isWithinTaskStartRadius,
  TASK_START_MAX_DISTANCE_METERS,
} from "@/lib/mobile/v1/tasks/geo-utils"
import type {
  MobileTaskStartRequest,
  MobileTaskStartResponse,
} from "@/lib/mobile/v1/tasks/types"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import type { Task } from "@/lib/types/tasks"
import { fetchActiveWorkTeamShift } from "@/lib/work-team-shifts/work-team-shifts.queries"
import type { SupabaseClient } from "@supabase/supabase-js"

type AdminClient = SupabaseClient

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

function mapOperationalChecklist(
  items: MobileOperationalChecklistItem[]
) {
  return items.map((item) => ({
    id: item.id,
    label: item.title,
    fieldType: item.fieldType,
    required: item.required,
    sortOrder: item.sortOrder,
  }))
}

async function insertTaskExecutionStart(
  client: AdminClient,
  input: {
    companyId: string
    taskId: string
    workTeamId: string
    mobileDeviceId: string
    startedBy: string
    latitude: number
    longitude: number
    accuracyMeters: number | null
    distanceToClientMeters: number | null
  }
) {
  const { error } = await (client as SupabaseClient).from("task_execution_starts").insert({
    company_id: input.companyId,
    task_id: input.taskId,
    work_team_id: input.workTeamId,
    mobile_device_id: input.mobileDeviceId,
    started_by: input.startedBy,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_meters: input.accuracyMeters,
    distance_to_client_meters: input.distanceToClientMeters,
  })

  if (error) {
    throw error
  }
}

export async function startMobileTask(
  auth: MobileAuthContext,
  taskId: string,
  request: MobileTaskStartRequest
): Promise<MobileTaskStartResponse> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, request.deviceId)

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

  if (task.dueDate !== today) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  if (task.status !== "asignada") {
    throw new MobileApiError(
      "TASK_INVALID_STATUS",
      "La orden de trabajo no puede iniciarse en su estado actual.",
      409
    )
  }

  if (task.latitude == null || task.longitude == null) {
    throw new MobileApiError(
      "TASK_LOCATION_REQUIRED",
      "La orden de trabajo no tiene ubicación registrada.",
      409
    )
  }

  const distanceToClientMeters = calculateDistanceMeters(
    request.latitude,
    request.longitude,
    task.latitude,
    task.longitude
  )

  if (
    !isWithinTaskStartRadius(
      request.latitude,
      request.longitude,
      task.latitude,
      task.longitude
    )
  ) {
    throw new MobileApiError(
      "TASK_LOCATION_OUT_OF_RANGE",
      `Se encuentra a ${Math.round(distanceToClientMeters)} metros del domicilio del cliente.`,
      409
    )
  }

  const startedAt = new Date().toISOString()

  const { data: updatedRow, error: updateError } = await admin
    .from("tasks")
    .update({ status: "en-curso" })
    .eq("id", task.id)
    .eq("company_id", auth.companyId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (updateError || !updatedRow) {
    throw updateError ?? new Error("TASK_UPDATE_FAILED")
  }

  const updatedTask = mapTaskRowToTask(updatedRow)

  await insertTaskExecutionStart(admin, {
    companyId: auth.companyId,
    taskId: task.id,
    workTeamId: resolved.workTeamId,
    mobileDeviceId: resolved.mobileDevice.id,
    startedBy: auth.employeeId,
    latitude: request.latitude,
    longitude: request.longitude,
    accuracyMeters: request.accuracyMeters,
    distanceToClientMeters,
  })

  const checklist = mapOperationalChecklist(
    await fetchOperationalChecklistForServiceType(
      admin,
      auth.companyId,
      updatedTask.serviceType?.trim() || ""
    )
  )

  try {
    await recordTaskMobileStartAudit({
      auth,
      before: task,
      after: updatedTask,
      workTeamId: resolved.workTeamId,
      workTeamName: resolved.workTeamName,
      mobileDeviceId: resolved.mobileDevice.id,
      latitude: request.latitude,
      longitude: request.longitude,
      accuracyMeters: request.accuracyMeters,
      distanceToClientMeters,
      startedAt,
    })
  } catch {
    // Start succeeded; audit failure must not block mobile clients.
  }

  return {
    id: updatedTask.id,
    status: updatedTask.status,
    startedAt,
    checklist,
  }
}
