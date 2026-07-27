import type {
  CommercialCommitmentPriority,
  CommercialCommitmentStatus,
} from "@/lib/commercial/location"
import type { CommercialCommitment } from "@/lib/types/commercial-commitments"
import type { CommercialRepositoryErrorCode } from "@/lib/types/supabase/commercial"

export type CreateCommercialCommitmentPayload = {
  companyId?: string
  opportunityId: string
  activityId?: string | null
  title: string
  description?: string
  assignedEmployeeId?: string | null
  dueAt: string
  priority?: CommercialCommitmentPriority
  status?: CommercialCommitmentStatus
  metadata?: Record<string, unknown>
  createdBy?: string | null
}

export type UpdateCommercialCommitmentPayload = Partial<{
  title: string
  description: string
  assignedEmployeeId: string | null
  dueAt: string
  priority: CommercialCommitmentPriority
  status: CommercialCommitmentStatus
  metadata: Record<string, unknown>
  updatedBy: string | null
}>

export type CommercialCommitmentRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CommercialRepositoryErrorCode
        message: string
      }
    }

export type CommercialCommitmentRowMapped = CommercialCommitment
