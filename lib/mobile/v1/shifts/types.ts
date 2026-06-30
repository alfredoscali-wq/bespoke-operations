import type { WorkTeamShiftStatus } from "@/lib/work-team-shifts/types"

export type MobileShiftLocation = {
  latitude: number
  longitude: number
}

export type MobileShiftDeviceRequest = {
  deviceId: string
}

export type MobileShiftStartRequest = MobileShiftDeviceRequest & MobileShiftLocation

export type MobileShiftFinishRequest = MobileShiftDeviceRequest & MobileShiftLocation

export type MobileShiftCurrentResponse = {
  status: WorkTeamShiftStatus
  workTeamId: string
  workTeamName: string
  shiftId?: string
  startedAt?: string
  startLatitude?: number
  startLongitude?: number
}

export type MobileShiftMutationResponse = MobileShiftCurrentResponse
