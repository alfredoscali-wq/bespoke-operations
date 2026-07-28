import "server-only"



import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"

import { MobileApiError } from "@/lib/mobile/v1/errors"

import type {

  MobilePresenceEventRequest,

  MobilePresenceEventResponse,

} from "@/lib/mobile/v1/presence/types"

import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"

import { logPresenceRejection } from "@/lib/presence/logging"

import {

  PresenceTargetLocationError,

  presenceService,

} from "@/lib/presence/presence-service.server"

import { startPerformanceTrace } from "@/lib/performance"

import { createAdminClient } from "@/lib/supabase/admin"



async function assertEmployeeBelongsToCompany(input: {

  companyId: string

  employeeId: string

}): Promise<void> {

  const admin = createAdminClient()

  const { data, error } = await admin

    .from("employees")

    .select("id")

    .eq("company_id", input.companyId)

    .eq("id", input.employeeId)

    .maybeSingle()



  if (error) {

    throw error

  }



  if (!data) {

    logPresenceRejection("employee_not_in_company", {

      companyId: input.companyId,

      employeeId: input.employeeId,

    })

    throw new MobileApiError(

      "EMPLOYEE_NOT_FOUND",

      "Empleado inexistente en la empresa.",

      404

    )

  }

}



/**

 * Mobile adapter: validates session/task/assignment/status then delegates

 * persistence to PresenceService (server authority for event type).

 */

export async function registerMobileTaskPresenceEvent(

  auth: MobileAuthContext,

  taskId: string,

  request: MobilePresenceEventRequest

): Promise<MobilePresenceEventResponse> {

  const perf = startPerformanceTrace("MOBILE PRESENCE EVENT", {

    layer: "backend",

  })

  try {

  if (request.employeeId !== auth.employeeId) {

    logPresenceRejection("employee_id_mismatch", {

      authEmployeeId: auth.employeeId,

      bodyEmployeeId: request.employeeId,

      taskId,

    })

    throw new MobileApiError(

      "INVALID_REQUEST",

      "employeeId no coincide con la sesión autenticada.",

      400

    )

  }



  await perf.span("Assert employee", () =>

    assertEmployeeBelongsToCompany({

      companyId: auth.companyId,

      employeeId: request.employeeId,

    })

  )



  let execution

  try {

    execution = await perf.span("Execution access", () =>

      assertMobileTaskExecutionAccess(

        auth,

        taskId,

        request.deviceId,

        {

          allowedStatuses: ["en-curso"],

          requireActiveShift: true,

        }

      )

    )

  } catch (error) {

    if (error instanceof MobileApiError) {

      logPresenceRejection("task_access_rejected", {

        code: error.code,

        taskId,

        employeeId: request.employeeId,

        clientEventType: request.eventType ?? null,

      })

    }

    throw error

  }



  try {

    const result = await perf.span("Presence register", () =>

      presenceService.registerEvent({

        companyId: auth.companyId,

        taskId: execution.task.id,

        employeeId: request.employeeId,

        latitude: request.latitude,

        longitude: request.longitude,

        accuracy: request.accuracy,

        provider: request.provider,

        deviceId: request.deviceId,

        createdAt: request.createdAt,

        clientEventType: request.eventType ?? null,

      })

    )



    const response = {

      eventId: result.event.id,

      duplicated: result.duplicated,

      eventType: result.event.eventType,

      createdAt: result.event.createdAt,

      operationalRadiusMeters: result.operationalRadiusMeters,

      distanceMeters: Math.round(result.distanceMeters),

      withinRadius: result.withinRadius,

    }

    perf.finish()

    return response

  } catch (error) {

    if (error instanceof PresenceTargetLocationError) {

      logPresenceRejection("target_location_required", {

        taskId,

        employeeId: request.employeeId,

      })

      throw new MobileApiError(

        "TASK_LOCATION_REQUIRED",

        error.message,

        409

      )

    }

    throw error

  }

  } catch (error) {

    perf.fail(error)

    throw error

  }

}


