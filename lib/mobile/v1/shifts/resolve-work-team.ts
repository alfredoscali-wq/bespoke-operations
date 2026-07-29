import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchCrewsForEmployeeMembership } from "@/lib/supabase/crews.queries"
import { resolveOperarioWorkerCrew } from "@/lib/operario/crew"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { fetchMobileDeviceWithCrewNameByCompanyAndDeviceId } from "@/lib/mobile-devices/mobile-devices.queries"
import type { MobileDeviceRecord } from "@/lib/mobile-devices/types"
import type { PerformanceTrace } from "@/lib/performance"

export type ResolvedMobileWorkTeam = {
  workTeamId: string
  workTeamName: string
  mobileDevice: MobileDeviceRecord
}

export async function resolveMobileWorkTeam(
  client: SupabaseClient,
  auth: MobileAuthContext,
  deviceId: string,
  perf?: PerformanceTrace
): Promise<ResolvedMobileWorkTeam> {
  const deviceLookup = await (perf
    ? perf.span("permissions", () =>
        fetchMobileDeviceWithCrewNameByCompanyAndDeviceId(
          client,
          auth.companyId,
          deviceId
        )
      )
    : fetchMobileDeviceWithCrewNameByCompanyAndDeviceId(
        client,
        auth.companyId,
        deviceId
      ))

  const deviceOk = perf
    ? perf.spanSync("validaciones", () => {
        if (!deviceLookup) {
          throw new MobileApiError(
            "DEVICE_NOT_FOUND",
            "Dispositivo no registrado.",
            404
          )
        }
        if (deviceLookup.device.status !== "ACTIVE") {
          throw new MobileApiError(
            "DEVICE_BLOCKED",
            "Dispositivo bloqueado.",
            403
          )
        }
        return deviceLookup
      })
    : (() => {
        if (!deviceLookup) {
          throw new MobileApiError(
            "DEVICE_NOT_FOUND",
            "Dispositivo no registrado.",
            404
          )
        }
        if (deviceLookup.device.status !== "ACTIVE") {
          throw new MobileApiError(
            "DEVICE_BLOCKED",
            "Dispositivo bloqueado.",
            403
          )
        }
        return deviceLookup
      })()

  if (deviceOk.device.workTeamId) {
    // Crew name already loaded in the same round-trip as the device.
    const workTeamName = perf
      ? perf.spanSync("crew", () => deviceOk.workTeamName)
      : deviceOk.workTeamName

    if (!workTeamName) {
      throw new MobileApiError(
        "WORK_TEAM_NOT_ASSIGNED",
        "Equipo de trabajo no asignado.",
        409
      )
    }

    // Device-bound team: employee membership was established at provision time.
    perf?.spanSync("employee", () => undefined)

    return {
      workTeamId: deviceOk.device.workTeamId,
      workTeamName,
      mobileDevice: deviceOk.device,
    }
  }

  const crewsResult = await (perf
    ? perf.span("crew", () =>
        fetchCrewsForEmployeeMembership(client, auth.companyId, auth.employeeId)
      )
    : fetchCrewsForEmployeeMembership(client, auth.companyId, auth.employeeId))

  if (crewsResult.error || !crewsResult.data) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      "No se pudo resolver el equipo de trabajo.",
      500
    )
  }

  const resolution = perf
    ? perf.spanSync("employee", () =>
        resolveOperarioWorkerCrew(auth.employeeId, crewsResult.data!)
      )
    : resolveOperarioWorkerCrew(auth.employeeId, crewsResult.data)

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
    mobileDevice: deviceOk.device,
  }
}
