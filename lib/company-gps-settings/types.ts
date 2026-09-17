export type CompanyGpsSettings = {
  shiftLocationValidationEnabled: boolean
  shiftRadiusMeters: number
  taskLocationValidationEnabled: boolean
  taskRadiusMeters: number
  gpsHeartbeatEnabled: boolean
  gpsHeartbeatIntervalSeconds: number
}

export type CompanyGpsSettingsRow = {
  shift_location_validation_enabled: boolean
  shift_radius_meters: number
  task_location_validation_enabled: boolean
  task_radius_meters: number
  gps_heartbeat_enabled: boolean
  gps_heartbeat_interval_seconds: number
}
