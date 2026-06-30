export const WORK_TEAM_SHIFT_STATUSES = {
  NOT_STARTED: "NOT_STARTED",
  ACTIVE: "ACTIVE",
  FINISHED: "FINISHED",
} as const

export type WorkTeamShiftStatus =
  (typeof WORK_TEAM_SHIFT_STATUSES)[keyof typeof WORK_TEAM_SHIFT_STATUSES]

export type WorkTeamShiftRecord = {
  id: string
  companyId: string
  workTeamId: string
  mobileDeviceId: string
  startedBy: string
  startedAt: string
  finishedBy: string | null
  finishedAt: string | null
  startLatitude: number
  startLongitude: number
  endLatitude: number | null
  endLongitude: number | null
  status: WorkTeamShiftStatus
  createdAt: string
  updatedAt: string
}
