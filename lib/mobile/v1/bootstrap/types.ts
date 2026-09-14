export type MobileBootstrapRequest = {
  companyCode: string
}

export type MobileBootstrapBranding = {
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
}

export type MobileBootstrapOperations = {
  shiftLocationValidationEnabled: boolean
  shiftRadiusMeters: number
  taskLocationValidationEnabled: boolean
  taskRadiusMeters: number
  gpsHeartbeatEnabled: boolean
  gpsHeartbeatIntervalSeconds: number
}

export type MobileBootstrapResponse = {
  companyId: string
  companyName: string
  branding: MobileBootstrapBranding
  operations: MobileBootstrapOperations
}
