import "server-only"

import {
  recordShiftFinishedAudit,
  recordShiftStartedAudit,
} from "@/lib/audit/shifts-audit.server"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import type {
  MobileShiftCurrentResponse,
  MobileShiftFinishRequest,
  MobileShiftMutationResponse,
  MobileShiftStartRequest,
} from "@/lib/mobile/v1/shifts/types"
import { createAdminClient } from "@/lib/supabase/admin"
import type { WorkTeamShiftRecord } from "@/lib/work-team-shifts/types"
import {
  fetchActiveWorkTeamShift,
  finishWorkTeamShift,
  insertWorkTeamShift,
} from "@/lib/work-team-shifts/work-team-shifts.queries"
import { WORK_TEAM_SHIFT_STATUSES } from "@/lib/work-team-shifts/types"

function mapShiftToCurrentResponse(
  workTeamId: string,
  workTeamName: string,
  shift: WorkTeamShiftRecord | null
): MobileShiftCurrentResponse {
  if (!shift || shift.status !== WORK_TEAM_SHIFT_STATUSES.ACTIVE) {
    return {
      status: WORK_TEAM_SHIFT_STATUSES.NOT_STARTED,
      workTeamId,
      workTeamName,
    }
  }

  return {
    status: WORK_TEAM_SHIFT_STATUSES.ACTIVE,
    workTeamId,
    workTeamName,
    shiftId: shift.id,
    startedAt: shift.startedAt,
    startLatitude: shift.startLatitude,
    startLongitude: shift.startLongitude,
  }
}

export async function getCurrentMobileShift(
  auth: MobileAuthContext,
  deviceId: string
): Promise<MobileShiftCurrentResponse> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, deviceId)
  const activeShift = await fetchActiveWorkTeamShift(
    admin,
    auth.companyId,
    resolved.workTeamId
  )

  return mapShiftToCurrentResponse(
    resolved.workTeamId,
    resolved.workTeamName,
    activeShift
  )
}

export async function startMobileShift(
  auth: MobileAuthContext,
  request: MobileShiftStartRequest
): Promise<MobileShiftMutationResponse> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, request.deviceId)

  const existingShift = await fetchActiveWorkTeamShift(
    admin,
    auth.companyId,
    resolved.workTeamId
  )

  if (existingShift) {
    throw new MobileApiError(
      "SHIFT_ALREADY_ACTIVE",
      "Ya existe una jornada activa para este equipo.",
      409
    )
  }

  let shift: WorkTeamShiftRecord

  try {
    shift = await insertWorkTeamShift(admin, {
      companyId: auth.companyId,
      workTeamId: resolved.workTeamId,
      mobileDeviceId: resolved.mobileDevice.id,
      startedBy: auth.employeeId,
      startLatitude: request.latitude,
      startLongitude: request.longitude,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : ""

    if (message.includes("work_team_shifts_one_active_per_team")) {
      throw new MobileApiError(
        "SHIFT_ALREADY_ACTIVE",
        "Ya existe una jornada activa para este equipo.",
        409
      )
    }

    throw error
  }

  try {
    await recordShiftStartedAudit(auth, shift, resolved.workTeamName)
  } catch {
    // Shift started; audit failure must not block mobile clients.
  }

  return mapShiftToCurrentResponse(
    resolved.workTeamId,
    resolved.workTeamName,
    shift
  )
}

export async function finishMobileShift(
  auth: MobileAuthContext,
  request: MobileShiftFinishRequest
): Promise<MobileShiftMutationResponse> {
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
      "No hay jornada activa para finalizar.",
      409
    )
  }

  const finishedShift = await finishWorkTeamShift(admin, {
    shiftId: activeShift.id,
    finishedBy: auth.employeeId,
    endLatitude: request.latitude,
    endLongitude: request.longitude,
  })

  try {
    await recordShiftFinishedAudit(auth, finishedShift, resolved.workTeamName)
  } catch {
    // Shift finished; audit failure must not block mobile clients.
  }

  return mapShiftToCurrentResponse(
    resolved.workTeamId,
    resolved.workTeamName,
    null
  )
}
