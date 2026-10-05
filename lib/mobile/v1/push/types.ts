import type { MobilePlatform } from "@/lib/mobile/v1/constants"

export type MobilePushTokenRequest = {
  deviceId: string
  pushToken: string
  platform: MobilePlatform
}

export type MobilePushTokenResponse = {
  registered: true
}

export type StoredPushTokenRow = {
  id: string
  company_id: string
  user_id: string
  device_id: string
  platform: MobilePlatform
  push_token: string
  enabled: boolean
  last_seen_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}
