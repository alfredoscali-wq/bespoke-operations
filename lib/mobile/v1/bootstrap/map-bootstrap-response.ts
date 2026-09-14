import type {
  MobileBootstrapBranding,
  MobileBootstrapOperations,
  MobileBootstrapResponse,
} from "@/lib/mobile/v1/bootstrap/types"

export type MobileBootstrapBrandingRow = {
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
}

export type MobileBootstrapOperationsRow = {
  shift_location_validation_enabled: boolean
  shift_radius_meters: number
  task_location_validation_enabled: boolean
  task_radius_meters: number
  gps_heartbeat_enabled: boolean
  gps_heartbeat_interval_seconds: number
}

/** Bootstrap payload defaults when no company_mobile_settings row exists. */
export const DEFAULT_MOBILE_BOOTSTRAP_OPERATIONS: MobileBootstrapOperations = {
  shiftLocationValidationEnabled: false,
  shiftRadiusMeters: 150,
  taskLocationValidationEnabled: false,
  taskRadiusMeters: 150,
  gpsHeartbeatEnabled: true,
  gpsHeartbeatIntervalSeconds: 60,
}

export function mapMobileBootstrapBranding(
  row: MobileBootstrapBrandingRow | null
): MobileBootstrapBranding {
  return {
    logoUrl: row?.logo_url ?? null,
    primaryColor: row?.primary_color ?? null,
    secondaryColor: row?.secondary_color ?? null,
  }
}

export function mapMobileBootstrapOperations(
  row: MobileBootstrapOperationsRow | null
): MobileBootstrapOperations {
  if (!row) {
    return { ...DEFAULT_MOBILE_BOOTSTRAP_OPERATIONS }
  }

  return {
    shiftLocationValidationEnabled: row.shift_location_validation_enabled,
    shiftRadiusMeters: row.shift_radius_meters,
    taskLocationValidationEnabled: row.task_location_validation_enabled,
    taskRadiusMeters: row.task_radius_meters,
    gpsHeartbeatEnabled: row.gps_heartbeat_enabled,
    gpsHeartbeatIntervalSeconds: row.gps_heartbeat_interval_seconds,
  }
}

export function mapMobileBootstrapResponse(input: {
  companyId: string
  companyName: string
  branding: MobileBootstrapBrandingRow | null
  operations?: MobileBootstrapOperationsRow | null
}): MobileBootstrapResponse {
  return {
    companyId: input.companyId,
    companyName: input.companyName,
    branding: mapMobileBootstrapBranding(input.branding),
    operations: mapMobileBootstrapOperations(input.operations ?? null),
  }
}
