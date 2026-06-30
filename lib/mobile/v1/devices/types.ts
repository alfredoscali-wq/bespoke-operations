import type { MobileDeviceStatus } from "@/lib/mobile-devices/types"

export type MobileProvisionDeviceRequest = {
  deviceId: string
  manufacturer: string
  model: string
  androidVersion: string
  appVersion: string
  platform: "android"
}

export type MobileProvisionDeviceResponse = {
  authorized: boolean
  status: MobileDeviceStatus
}
