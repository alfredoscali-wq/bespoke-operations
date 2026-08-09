import "server-only"

import { recordTaskMobileStartActivity } from "@/lib/activity/adapters/tasks-activity.server"
import { recordTaskMobileStartAudit } from "@/lib/audit/tasks-audit.server"
import { toLocalDateOnly } from "@/lib/dates/date-only"
import { isOperationalDateRangeActive } from "@/lib/mobile/v1/agenda/agenda-task-visibility"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { fetchOperationalChecklistForServiceType } from "@/lib/mobile/v1/checklist/checklist-queries"
import type { MobileOperationalChecklistItem } from "@/lib/mobile/v1/checklist/types"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import {
  evaluateTaskStartDistancePolicy,
  getTaskStartDistanceEnforcementRuntimeSnapshot,
} from "@/lib/mobile/v1/tasks/geo-utils"
import { resolveMobileTaskCommercialFields } from "@/lib/mobile/v1/tasks/task-commercial-fields"
import { resolveWorkOrderTechnologyFromTask } from "@/lib/tasks/work-order"
import { resolveTaskStartCoordinates } from "@/lib/mobile/v1/tasks/resolve-task-start-coordinates"
import { buildTaskStartLocationRequiredMessage } from "@/lib/mobile/v1/tasks/task-start-coordinates"
import type {
  MobileTaskStartRequest,
  MobileTaskStartResponse,
} from "@/lib/mobile/v1/tasks/types"
import { startPerformanceTrace } from "@/lib/performance"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import type { Task } from "@/lib/types/tasks"
import { resolveOperationalEventActorFromMobile } from "@/lib/tasks/operational-event-actor"
import { buildStartedOperationalEvent } from "@/lib/tasks/operational-events"
import { recordOperationalEventOnce } from "@/lib/tasks/record-operational-event.server"
import { fetchActiveWorkTeamShift } from "@/lib/work-team-shifts/work-team-shifts.queries"
import type { SupabaseClient } from "@supabase/supabase-js"

type AdminClient = SupabaseClient

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
  const perf = startPerformanceTrace("MOBILE TASK START", { layer: "backend" })
  try {
    const admin = createAdminClient()

    perf.section("Resolve work team")
    const resolved = await resolveMobileWorkTeam(
      admin,
      auth,
      request.deviceId,
      perf
    )

    perf.section("Fetch active shift")
    const activeShift = await perf.span("consulta", () =>
      fetchActiveWorkTeamShift(admin, auth.companyId, resolved.workTeamId)
    )
    perf.spanSync("validaciones", () => {
      if (!activeShift) {
        throw new MobileApiError(
          "SHIFT_NOT_ACTIVE",
          "No hay jornada activa.",
          409
        )
      }
    })

    perf.section("Load task")
    const taskRow = await perf.span("SELECT principal", async () => {
      const { data, error } = await admin
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .eq("company_id", auth.companyId)
        .is("deleted_at", null)
        .maybeSingle()
      if (error) throw error
      return data
    })
    const task = perf.spanSync("joins", () =>
      taskRow ? mapTaskRowToTask(taskRow) : null
    )
    perf.spanSync("validaciones", () => {
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
      if (!isOperationalDateRangeActive(task, today)) {
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
    })

    if (!task) {
      throw new MobileApiError(
        "TASK_NOT_FOUND",
        "Orden de trabajo no encontrada.",
        404
      )
    }

    perf.section("Resolve coordinates")
    const startCoordinates = await resolveTaskStartCoordinates(
      admin,
      auth.companyId,
      task,
      perf
    )
    if (!startCoordinates) {
      throw new MobileApiError(
        "TASK_LOCATION_REQUIRED",
        buildTaskStartLocationRequiredMessage(Boolean(task.projectId)),
        409
      )
    }

    perf.section("Distance policy")
    const distancePolicy = perf.spanSync("calculo", () =>
      evaluateTaskStartDistancePolicy({
        operatorLatitude: request.latitude,
        operatorLongitude: request.longitude,
        targetLatitude: startCoordinates.latitude,
        targetLongitude: startCoordinates.longitude,
      })
    )
    const distanceToClientMeters = distancePolicy.distanceToClientMeters
    const enforcementRuntime = getTaskStartDistanceEnforcementRuntimeSnapshot()
    // Ops diagnostic only — does not alter allow/deny. Never logs raw env values.
    console.warn("[Mobile API][task-start-distance]", {
      taskId: task.id,
      distanceMeters: Math.round(distanceToClientMeters),
      withinRadius: distancePolicy.withinRadius,
      shouldBlock: distancePolicy.shouldBlock,
      policyEnforcementEnabled: distancePolicy.enforcementEnabled,
      runtime: enforcementRuntime,
    })
    perf.spanSync("validacion", () => {
      if (distancePolicy.shouldBlock) {
        throw new MobileApiError(
          "TASK_LOCATION_OUT_OF_RANGE",
          distancePolicy.message ??
            `Se encuentra a ${Math.round(distanceToClientMeters)} metros del domicilio del cliente.`,
          409
        )
      }
    })

    const startedAt = new Date().toISOString()

    perf.section("Update task")
    const updatedRow = await perf.span("UPDATE principal", async () => {
      const { data, error: updateError } = await admin
        .from("tasks")
        .update({ status: "en-curso" })
        .eq("id", task.id)
        .eq("company_id", auth.companyId)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle()

      if (updateError || !data) {
        throw updateError ?? new Error("TASK_UPDATE_FAILED")
      }
      return data
    })
    const updatedTask = perf.spanSync("UPDATE secundarios", () =>
      mapTaskRowToTask(updatedRow)
    )

    perf.section("Insert execution start")
    await perf.span("INSERT", () =>
      insertTaskExecutionStart(admin, {
        companyId: auth.companyId,
        taskId: task.id,
        workTeamId: resolved.workTeamId,
        mobileDeviceId: resolved.mobileDevice.id,
        startedBy: auth.employeeId,
        latitude: request.latitude,
        longitude: request.longitude,
        accuracyMeters: request.accuracyMeters,
        distanceToClientMeters,
      }),
      { detail: "includes commit" }
    )

    // Independent post-mutation work: same writes/reads, overlapped wall-clock.
    // runSection keeps each component's spans grouped despite parallel completion.
    const [, , , checklist] = await Promise.all([
      (async () => {
        try {
          await perf.runSection("Operational Event", async (section) => {
            const event = section.spanSync("payload", () =>
              buildStartedOperationalEvent({
                companyId: auth.companyId,
                task,
                actor: resolveOperationalEventActorFromMobile(auth),
                source: "mobile",
                latitude: request.latitude,
                longitude: request.longitude,
              })
            )
            await recordOperationalEventOnce({ event, perf: section })
          })
        } catch {
          // Non-blocking operational history.
        }
      })(),
      (async () => {
        try {
          await perf.runSection("Audit", async (section) => {
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
              perf: section,
            })
          })
        } catch {
          // Start succeeded; audit failure must not block mobile clients.
        }
      })(),
      (async () => {
        try {
          await perf.runSection("Activity", async (section) => {
            await recordTaskMobileStartActivity({
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
              perf: section,
            })
          })
        } catch {
          // Start succeeded; OIE failure must not block mobile clients.
        }
      })(),
      perf.runSection("Checklist", async (section) => {
        const rows = await section.span("query", () =>
          fetchOperationalChecklistForServiceType(
            admin,
            auth.companyId,
            updatedTask.serviceType?.trim() || "",
            resolveWorkOrderTechnologyFromTask(updatedTask)
          )
        )
        return section.spanSync("transform", () => mapOperationalChecklist(rows))
      }),
    ])

    const response = {
      id: updatedTask.id,
      status: updatedTask.status,
      startedAt,
      checklist,
      ...resolveMobileTaskCommercialFields(updatedTask),
    }
    perf.finish()
    return response
  } catch (error) {
    perf.fail(error)
    throw error
  }
}
