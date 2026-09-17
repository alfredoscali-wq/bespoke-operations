import {
  DEFAULT_COMPANY_GPS_SETTINGS,
  GPS_RADIUS_MAX_METERS,
  GPS_RADIUS_MIN_METERS,
} from "@/lib/company-gps-settings/constants"
import type {
  CompanyGpsSettings,
  CompanyGpsSettingsRow,
} from "@/lib/company-gps-settings/types"
import {
  GPS_HEARTBEAT_INTERVAL_MAX_SECONDS,
  GPS_HEARTBEAT_INTERVAL_MIN_SECONDS,
} from "@/lib/gps-live/constants"
import { mapCompanyGpsHeartbeatSettings } from "@/lib/gps-live/heartbeat-policy"
import { mapCompanyShiftLocationSettings } from "@/lib/mobile/v1/shifts/shift-location-validation"
import { mapCompanyTaskLocationSettings } from "@/lib/mobile/v1/tasks/task-location-validation"

export function mapCompanyGpsSettings(
  row: CompanyGpsSettingsRow | null
): CompanyGpsSettings {
  if (!row) {
    return { ...DEFAULT_COMPANY_GPS_SETTINGS }
  }

  const shift = mapCompanyShiftLocationSettings({
    shift_location_validation_enabled: row.shift_location_validation_enabled,
    shift_radius_meters: row.shift_radius_meters,
  })
  const task = mapCompanyTaskLocationSettings({
    task_location_validation_enabled: row.task_location_validation_enabled,
    task_radius_meters: row.task_radius_meters,
  })
  const heartbeat = mapCompanyGpsHeartbeatSettings({
    gps_heartbeat_enabled: row.gps_heartbeat_enabled,
    gps_heartbeat_interval_seconds: row.gps_heartbeat_interval_seconds,
  })

  return {
    shiftLocationValidationEnabled: shift.shiftLocationValidationEnabled,
    shiftRadiusMeters: shift.shiftRadiusMeters,
    taskLocationValidationEnabled: task.taskLocationValidationEnabled,
    taskRadiusMeters: task.taskRadiusMeters,
    gpsHeartbeatEnabled: heartbeat.gpsHeartbeatEnabled,
    gpsHeartbeatIntervalSeconds: heartbeat.gpsHeartbeatIntervalSeconds,
  }
}

function parseRequiredBoolean(
  value: unknown,
  message: string
): { ok: true; value: boolean } | { ok: false; message: string } {
  if (typeof value !== "boolean") {
    return { ok: false, message }
  }
  return { ok: true, value }
}

function parseRequiredRadiusMeters(
  value: unknown,
  message: string
): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, message }
  }
  if (value < GPS_RADIUS_MIN_METERS || value > GPS_RADIUS_MAX_METERS) {
    return { ok: false, message }
  }
  return { ok: true, value }
}

function parseRequiredHeartbeatInterval(
  value: unknown
): { ok: true; value: number } | { ok: false; message: string } {
  const message = `El intervalo GPS debe ser un entero entre ${GPS_HEARTBEAT_INTERVAL_MIN_SECONDS} y ${GPS_HEARTBEAT_INTERVAL_MAX_SECONDS} segundos.`
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, message }
  }
  if (
    value < GPS_HEARTBEAT_INTERVAL_MIN_SECONDS ||
    value > GPS_HEARTBEAT_INTERVAL_MAX_SECONDS
  ) {
    return { ok: false, message }
  }
  return { ok: true, value }
}

export function parseCompanyGpsSettingsPut(
  input: Record<string, unknown>,
  current: CompanyGpsSettings = DEFAULT_COMPANY_GPS_SETTINGS
): { ok: true; settings: CompanyGpsSettings } | { ok: false; message: string } {
  const shiftEnabled = parseRequiredBoolean(
    input.shiftLocationValidationEnabled,
    "Validar GPS al iniciar jornada debe ser verdadero o falso."
  )
  if (!shiftEnabled.ok) return shiftEnabled

  const shiftRadius = parseRequiredRadiusMeters(
    input.shiftRadiusMeters,
    `El radio de jornada debe ser un entero entre ${GPS_RADIUS_MIN_METERS} y ${GPS_RADIUS_MAX_METERS} metros.`
  )
  if (!shiftRadius.ok) return shiftRadius

  const taskEnabled = parseRequiredBoolean(
    input.taskLocationValidationEnabled,
    "Validar GPS al iniciar OT debe ser verdadero o falso."
  )
  if (!taskEnabled.ok) return taskEnabled

  const taskRadius = parseRequiredRadiusMeters(
    input.taskRadiusMeters,
    `El radio de OT debe ser un entero entre ${GPS_RADIUS_MIN_METERS} y ${GPS_RADIUS_MAX_METERS} metros.`
  )
  if (!taskRadius.ok) return taskRadius

  let gpsHeartbeatEnabled = current.gpsHeartbeatEnabled
  if (input.gpsHeartbeatEnabled !== undefined) {
    const heartbeatEnabled = parseRequiredBoolean(
      input.gpsHeartbeatEnabled,
      "El seguimiento GPS en vivo debe ser verdadero o falso."
    )
    if (!heartbeatEnabled.ok) return heartbeatEnabled
    gpsHeartbeatEnabled = heartbeatEnabled.value
  }

  let gpsHeartbeatIntervalSeconds = current.gpsHeartbeatIntervalSeconds
  if (input.gpsHeartbeatIntervalSeconds !== undefined) {
    const heartbeatInterval = parseRequiredHeartbeatInterval(
      input.gpsHeartbeatIntervalSeconds
    )
    if (!heartbeatInterval.ok) return heartbeatInterval
    gpsHeartbeatIntervalSeconds = heartbeatInterval.value
  }

  return {
    ok: true,
    settings: {
      shiftLocationValidationEnabled: shiftEnabled.value,
      shiftRadiusMeters: shiftRadius.value,
      taskLocationValidationEnabled: taskEnabled.value,
      taskRadiusMeters: taskRadius.value,
      gpsHeartbeatEnabled,
      gpsHeartbeatIntervalSeconds,
    },
  }
}
