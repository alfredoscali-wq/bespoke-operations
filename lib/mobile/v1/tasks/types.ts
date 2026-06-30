import type { TaskPriority, TaskStatus } from "@/lib/types/tasks"

export type MobileTaskChecklistItem = {
  id: string
  label: string
  required: boolean
}

export type MobileTaskEvidenceRequirement = {
  id: string
  label: string
  stepKind: "text" | "photo"
  required: boolean
}

export type MobileTaskNextWorkItem = {
  scheduledTime: string | null
  workType: string
  customerOrAssetName: string
}

export type MobileTaskDetailResponse = {
  id: string
  workOrderNumber: string | null
  workType: string
  status: TaskStatus
  priority: TaskPriority
  scheduledTime: string | null
  customerOrAssetName: string
  contactPerson: string | null
  phone: string | null
  address: string
  locality: string | null
  latitude: number | null
  longitude: number | null
  observations: string | null
  amountToCollect: number | null
  technology: string | null
  contractedPlan: string | null
  checklist: MobileTaskChecklistItem[]
  evidenceRequirements: MobileTaskEvidenceRequirement[]
  nextWork: MobileTaskNextWorkItem | null
}
