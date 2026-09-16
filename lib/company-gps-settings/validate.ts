import {
  DEFAULT_COMPANY_GPS_SETTINGS,
  GPS_RADIUS_MAX_METERS,
  GPS_RADIUS_MIN_METERS,
} from "@/lib/company-gps-settings/constants"
import type {
  CompanyGpsSettings,
  CompanyGpsSettingsRow,
} from "@/lib/company-gps-settings/types"
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

  return {
    shiftLocationValidationEnabled: shift.shiftLocationValidationEnabled,
    shiftRadiusMeters: shift.shiftRadiusMeters,
    taskLocationValidationEnabled: task.taskLocationValidationEnabled,
    taskRadiusMeters: task.taskRadiusMeters,
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

export function parseCompanyGpsSettingsPut(
  input: Record<string, unknown>
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

  return {
    ok: true,
    settings: {
      shiftLocationValidationEnabled: shiftEnabled.value,
      shiftRadiusMeters: shiftRadius.value,
      taskLocationValidationEnabled: taskEnabled.value,
      taskRadiusMeters: taskRadius.value,
    },
  }
}
