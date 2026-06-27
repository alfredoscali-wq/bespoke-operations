import type { NewProjectInput, ProjectStatus, ProjectType } from "@/lib/types/projects"

export type CreateProjectPayload = NewProjectInput & {
  companyId?: string
  status?: ProjectStatus
  progress?: number
}

export type UpdateProjectPayload = Partial<{
  code: string
  name: string
  client: string
  type: ProjectType
  status: ProjectStatus
  progress: number
  startDate?: string | null
  endDate?: string | null
  supervisor: string
  location: string
  description: string
  pauseReason?: string | null
  pauseNotes?: string | null
  pausedAt?: string | null
  deletedAt?: string | null
}>

export type ProjectsRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_CODE"
  | "VALIDATION"
  | "ACTIVE_TASKS"
  | "UNKNOWN"

export type ProjectsRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: ProjectsRepositoryErrorCode
        message: string
      }
    }
