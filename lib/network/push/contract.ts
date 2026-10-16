export const NETWORK_PUSH_PLATFORMS = ["android"] as const

export type NetworkPushPlatform = (typeof NETWORK_PUSH_PLATFORMS)[number]

export type NetworkPushTokenRecord = {
  id: string
  companyId: string
  userId: string
  /** Mobile `mobile_devices.device_id`. Not `network_devices.id`. */
  deviceId: string
  platform: NetworkPushPlatform
  enabled: boolean
  lastSeenAt: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export function isNetworkPushPlatform(
  value: unknown
): value is NetworkPushPlatform {
  return (
    typeof value === "string" &&
    (NETWORK_PUSH_PLATFORMS as readonly string[]).includes(value)
  )
}
