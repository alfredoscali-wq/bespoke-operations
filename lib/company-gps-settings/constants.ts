import type { CompanyGpsSettings } from "@/lib/company-gps-settings/types"
import {
  DEFAULT_GPS_HEARTBEAT_ENABLED,
  DEFAULT_GPS_HEARTBEAT_INTERVAL_SECONDS,
} from "@/lib/gps-live/constants"

/** Matches company_mobile_settings CHECK (1–10000). */
export const GPS_RADIUS_MIN_METERS = 1
export const GPS_RADIUS_MAX_METERS = 10_000

/** Matches company_mobile_settings / bootstrap defaults. */
export const DEFAULT_COMPANY_GPS_SETTINGS: CompanyGpsSettings = {
  shiftLocationValidationEnabled: false,
  shiftRadiusMeters: 150,
  taskLocationValidationEnabled: false,
  taskRadiusMeters: 150,
  gpsHeartbeatEnabled: DEFAULT_GPS_HEARTBEAT_ENABLED,
  gpsHeartbeatIntervalSeconds: DEFAULT_GPS_HEARTBEAT_INTERVAL_SECONDS,
}
