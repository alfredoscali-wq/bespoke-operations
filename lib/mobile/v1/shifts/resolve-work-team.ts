import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchCrews } from "@/lib/supabase/crews.queries"
import { resolveOperarioWorkerCrew } from "@/lib/operario/crew"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { fetchMobileDeviceByCompanyAndDeviceId } from "@/lib/mobile-devices/mobile-devices.queries"
import type { MobileDeviceRecord } from "@/lib/mobile-devices/types"
import { fetchCrewNameById } from "@/lib/work-team-shifts/work-team-shifts.queries"

export type ResolvedMobileWorkTeam = {
  workTeamId: string
  workTeamName: string
  mobileDevice: MobileDeviceRecord
}

export async function resolveMobileWorkTeam(
  client: SupabaseClient,
  auth: MobileAuthContext,
  deviceId: string
): Promise<ResolvedMobileWorkTeam> {
  const mobileDevice = await fetchMobileDeviceByCompanyAndDeviceId(
    client,
    auth.companyId,
    deviceId
  )

  if (!mobileDevice) {
    throw new MobileApiError(
      "DEVICE_NOT_FOUND",
      "Dispositivo no registrado.",
      404
    )
  }

  if (mobileDevice.status !== "ACTIVE") {
    throw new MobileApiError(
      "DEVICE_BLOCKED",
      "Dispositivo bloqueado.",
      403
    )
  }

  if (mobileDevice.workTeamId) {
    const workTeamName = await fetchCrewNameById(client, mobileDevice.workTeamId)

    if (!workTeamName) {
      throw new MobileApiError(
        "WORK_TEAM_NOT_ASSIGNED",
        "Equipo de trabajo no asignado.",
        409
      )
    }

    return {
      workTeamId: mobileDevice.workTeamId,
      workTeamName,
      mobileDevice,
    }
  }

  const crewsResult = await fetchCrews(client, auth.companyId)

  if (crewsResult.error || !crewsResult.data) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      "No se pudo resolver el equipo de trabajo.",
      500
    )
  }

  const resolution = resolveOperarioWorkerCrew(auth.employeeId, crewsResult.data)

  if (resolution.crewStatus === "unassigned" || !resolution.workerCrewRef.id) {
    throw new MobileApiError(
      "WORK_TEAM_NOT_ASSIGNED",
      "Equipo de trabajo no asignado.",
      409
    )
  }

  return {
    workTeamId: resolution.workerCrewRef.id,
    workTeamName: resolution.workerCrewRef.name,
    mobileDevice,
  }
}
