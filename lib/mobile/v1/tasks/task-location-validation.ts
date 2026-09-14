/** Matches company_mobile_settings / bootstrap defaults. Runtime OFF until configured. */
export const DEFAULT_TASK_LOCATION_VALIDATION_ENABLED = false
export const DEFAULT_TASK_RADIUS_METERS = 150

export type CompanyTaskLocationSettings = {
  taskLocationValidationEnabled: boolean
  taskRadiusMeters: number
}

export function mapCompanyTaskLocationSettings(
  row: {
    task_location_validation_enabled: boolean
    task_radius_meters: number
  } | null
): CompanyTaskLocationSettings {
  if (!row) {
    return {
      taskLocationValidationEnabled: DEFAULT_TASK_LOCATION_VALIDATION_ENABLED,
      taskRadiusMeters: DEFAULT_TASK_RADIUS_METERS,
    }
  }

  return {
    taskLocationValidationEnabled: row.task_location_validation_enabled,
    taskRadiusMeters: row.task_radius_meters,
  }
}
