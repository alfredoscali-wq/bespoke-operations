import "server-only"

import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import { shouldAcceptGpsHeartbeat } from "@/lib/gps-live/heartbeat-policy"
import {
  fetchWorkTeamLocation,
  loadCompanyGpsHeartbeatSettings,
  upsertWorkTeamLocation,
} from "@/lib/gps-live/locations.queries"
import type {
  GpsLiveHeartbeatAccepted,
  GpsLiveHeartbeatRequest,
} from "@/lib/gps-live/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchActiveWorkTeamShift } from "@/lib/work-team-shifts/work-team-shifts.queries"

export async function registerMobileGpsHeartbeat(
  auth: MobileAuthContext,
  request: GpsLiveHeartbeatRequest
): Promise<GpsLiveHeartbeatAccepted> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, request.deviceId)
  if (!resolved.mobileDevice.workTeamId) {
    throw new MobileApiError(
      "WORK_TEAM_NOT_ASSIGNED",
      "Dispositivo no asociado a una cuadrilla.",
      409
    )
  }
  const activeShift = await fetchActiveWorkTeamShift(
    admin,
    auth.companyId,
    resolved.workTeamId
  )
  const settings = await loadCompanyGpsHeartbeatSettings(admin, auth.companyId)
  const existing = await fetchWorkTeamLocation(
    admin,
    auth.companyId,
    resolved.workTeamId
  )
  const nowMs = Date.now()
  const decision = shouldAcceptGpsHeartbeat({
    heartbeatEnabled: settings.gpsHeartbeatEnabled,
    shiftActive: Boolean(activeShift),
    lastReceivedAt: existing?.received_at ?? null,
    nowMs,
  })

  if (!decision.accept) {
    if (decision.reason === "shift_inactive") {
      throw new MobileApiError(
        "SHIFT_NOT_ACTIVE",
        "No hay jornada activa.",
        409
      )
    }
    if (decision.reason === "disabled") {
      throw new MobileApiError(
        "GPS_HEARTBEAT_DISABLED",
        "El seguimiento GPS está desactivado para esta empresa.",
        409
      )
    }
    throw new MobileApiError(
      "GPS_HEARTBEAT_TOO_FREQUENT",
      "Heartbeat demasiado frecuente.",
      429
    )
  }

  const receivedAt = new Date(nowMs).toISOString()
  const saved = await upsertWorkTeamLocation(admin, {
    companyId: auth.companyId,
    workTeamId: resolved.workTeamId,
    deviceId: resolved.mobileDevice.id,
    latitude: request.latitude,
    longitude: request.longitude,
    accuracyMeters: request.accuracyMeters,
    capturedAt: request.timestamp,
    receivedAt,
  })

  return {
    accepted: true,
    workTeamId: resolved.workTeamId,
    latitude: saved.latitude,
    longitude: saved.longitude,
    accuracyMeters: saved.accuracy_meters,
    capturedAt: saved.captured_at,
    receivedAt: saved.received_at,
  }
}
