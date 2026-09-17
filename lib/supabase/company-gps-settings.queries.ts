import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { mapCompanyGpsSettings } from "@/lib/company-gps-settings/validate"
import type { CompanyGpsSettings } from "@/lib/company-gps-settings/types"
import type { Database } from "@/lib/supabase/database.types"

type GpsSettingsClient = SupabaseClient<Database>

const GPS_SETTINGS_SELECT =
  "shift_location_validation_enabled, shift_radius_meters, task_location_validation_enabled, task_radius_meters, gps_heartbeat_enabled, gps_heartbeat_interval_seconds"

export async function fetchCompanyGpsSettings(
  client: GpsSettingsClient,
  companyId: string
): Promise<CompanyGpsSettings> {
  const { data, error } = await client
    .from("company_mobile_settings")
    .select(GPS_SETTINGS_SELECT)
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return mapCompanyGpsSettings(data ?? null)
}

export async function upsertCompanyGpsSettings(
  client: GpsSettingsClient,
  companyId: string,
  settings: CompanyGpsSettings
): Promise<{ data: CompanyGpsSettings | null; error: string | null }> {
  const { data, error } = await client
    .from("company_mobile_settings")
    .upsert(
      {
        company_id: companyId,
        shift_location_validation_enabled: settings.shiftLocationValidationEnabled,
        shift_radius_meters: settings.shiftRadiusMeters,
        task_location_validation_enabled: settings.taskLocationValidationEnabled,
        task_radius_meters: settings.taskRadiusMeters,
        gps_heartbeat_enabled: settings.gpsHeartbeatEnabled,
        gps_heartbeat_interval_seconds: settings.gpsHeartbeatIntervalSeconds,
      },
      { onConflict: "company_id" }
    )
    .select(GPS_SETTINGS_SELECT)
    .single()

  if (error || !data) {
    return {
      data: null,
      error: error?.message ?? "No se pudo guardar la configuración GPS.",
    }
  }

  return { data: mapCompanyGpsSettings(data), error: null }
}
