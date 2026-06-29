import type { MobilePlatform } from "@/lib/mobile/v1/constants"
import type { SystemRole } from "@/lib/types/employees"

export type MobileLoginRequest = {
  email: string
  password: string
  deviceId: string
  appVersion: string
  platform: MobilePlatform
}

export type MobileLoginUser = {
  id: string
  name: string
  email: string
  companyId: string
  employeeId: string
  role: SystemRole
}

export type MobileLoginResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: MobileLoginUser
}
