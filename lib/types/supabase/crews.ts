import type { Crew, CrewStatus } from "@/lib/types/crews"

export type CreateCrewPayload = {
  companyId?: string
  name: string
  description?: string
  supervisor: string
  supervisorEmployeeId?: string | null
  status?: CrewStatus
  notes?: string
}

export type UpdateCrewPayload = Partial<{
  name: string
  description: string
  supervisor: string
  supervisorEmployeeId: string | null
  status: CrewStatus
  notes: string
}>

export type CreateCrewMemberPayload = {
  crewId: string
  employeeId?: string | null
  name: string
  role: string
  phone?: string | null
  active?: boolean
}

export type UpdateCrewMemberPayload = Partial<{
  employeeId: string | null
  name: string
  role: string
  phone: string | null
  active: boolean
}>

export type CrewsRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_NAME"
  | "DUPLICATE_EMPLOYEE"
  | "VALIDATION"
  | "UNKNOWN"

export type CrewsRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CrewsRepositoryErrorCode
        message: string
      }
    }

export type CrewWithMembers = Crew
