import type { WorkOrderServiceType } from "@/lib/tasks/work-order"

export type WorkOrderTypeChecklistItem = {
  id: string
  companyId: string
  serviceType: WorkOrderServiceType | string
  title: string
  required: boolean
  requiresPhoto: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export type WorkOrderTypeChecklistItemInput = {
  title: string
  required: boolean
  requiresPhoto: boolean
}
