import type {
  CommercialCommitmentPriority,
  CommercialCommitmentStatus,
} from "@/lib/commercial/location"

export type CommercialCommitment = {
  id: string
  companyId: string
  opportunityId: string
  activityId: string | null
  title: string
  description: string
  assignedEmployeeId: string | null
  dueAt: string
  priority: CommercialCommitmentPriority
  status: CommercialCommitmentStatus
  metadata: Record<string, unknown>
  createdBy: string | null
  updatedBy: string | null
  deletedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CommercialActivityNextStep = {
  commitmentId?: string
  title: string
  dueAt: string
  priority: CommercialCommitmentPriority
  assignedEmployeeId?: string | null
}

export type CommercialActivityResultMetadata = {
  result?: string
  resultOther?: string
  nextStep?: CommercialActivityNextStep | null
}
