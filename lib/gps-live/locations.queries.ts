import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { MobileApiError, MOBILE_API_ERROR_MESSAGES } from "@/lib/mobile/v1/errors"
import { mapCompanyGpsHeartbeatSettings } from "@/lib/gps-live/heartbeat-policy"
import type { CompanyGpsHeartbeatSettings } from "@/lib/gps-live/types"
import type { Database } from "@/lib/supabase/database.types"

type LocationsClient = SupabaseClient<Database>

export async function loadCompanyGpsHeartbeatSettings(
  client: LocationsClient,
  companyId: string
): Promise<CompanyGpsHeartbeatSettings> {
  const { data, error } = await client
    .from("company_mobile_settings")
    .select("gps_heartbeat_enabled, gps_heartbeat_interval_seconds")
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
      500
    )
  }

  return mapCompanyGpsHeartbeatSettings(data ?? null)
}

export type WorkTeamLocationRow = {
  company_id: string
  work_team_id: string
  device_id: string
  latitude: number
  longitude: number
  accuracy_meters: number | null
  captured_at: string
  received_at: string
}

export async function fetchWorkTeamLocation(
  client: LocationsClient,
  companyId: string,
  workTeamId: string
): Promise<WorkTeamLocationRow | null> {
  const { data, error } = await client
    .from("company_work_team_locations")
    .select(
      "company_id, work_team_id, device_id, latitude, longitude, accuracy_meters, captured_at, received_at"
    )
    .eq("company_id", companyId)
    .eq("work_team_id", workTeamId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function upsertWorkTeamLocation(
  client: LocationsClient,
  input: {
    companyId: string
    workTeamId: string
    deviceId: string
    latitude: number
    longitude: number
    accuracyMeters: number | null
    capturedAt: string
    receivedAt: string
  }
): Promise<WorkTeamLocationRow> {
  const { data, error } = await client
    .from("company_work_team_locations")
    .upsert(
      {
        company_id: input.companyId,
        work_team_id: input.workTeamId,
        device_id: input.deviceId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy_meters: input.accuracyMeters,
        captured_at: input.capturedAt,
        received_at: input.receivedAt,
      },
      { onConflict: "company_id,work_team_id" }
    )
    .select(
      "company_id, work_team_id, device_id, latitude, longitude, accuracy_meters, captured_at, received_at"
    )
    .single()

  if (error || !data) {
    throw error ?? new Error("No se pudo guardar la posición GPS.")
  }

  return data
}

export async function fetchWorkTeamLocationsForCompany(
  client: LocationsClient,
  companyId: string
): Promise<WorkTeamLocationRow[]> {
  const { data, error } = await client
    .from("company_work_team_locations")
    .select(
      "company_id, work_team_id, device_id, latitude, longitude, accuracy_meters, captured_at, received_at"
    )
    .eq("company_id", companyId)

  if (error) {
    throw error
  }

  return data ?? []
}
