import type { Crew, CrewMember, CrewStatus } from "@/lib/types/crews"

export type CreateCrewPayload = {
  name: string
  description?: string
  supervisor: string
  status?: CrewStatus
  notes?: string
}

export type UpdateCrewPayload = Partial<{
  name: string
  description: string
  supervisor: string
  status: CrewStatus
  notes: string
}>

export type CreateCrewMemberPayload = {
  crewId: string
  name: string
  role: string
  phone?: string | null
  active?: boolean
}

export type UpdateCrewMemberPayload = Partial<{
  name: string
  role: string
  phone: string | null
  active: boolean
}>

export type CrewsRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_NAME"
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
