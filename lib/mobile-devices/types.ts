export const MOBILE_DEVICE_STATUSES = {
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
} as const

export type MobileDeviceStatus =
  (typeof MOBILE_DEVICE_STATUSES)[keyof typeof MOBILE_DEVICE_STATUSES]

export type MobileDeviceRecord = {
  id: string
  companyId: string
  workTeamId: string | null
  deviceId: string
  manufacturer: string
  model: string
  androidVersion: string
  appVersion: string
  platform: string
  status: MobileDeviceStatus
  registeredAt: string
  lastSeenAt: string
  createdAt: string
  updatedAt: string
}
