import type { WorkOrderServiceType } from "@/lib/tasks/work-order"
import type { ChecklistFieldType } from "@/lib/work-order-types/checklist-field-types"
import type { ChecklistTechnologyScope } from "@/lib/work-order-types/checklist-technology"

export type WorkOrderTypeChecklistItem = {
  id: string
  companyId: string
  serviceType: WorkOrderServiceType | string
  technology: ChecklistTechnologyScope
  title: string
  fieldType: ChecklistFieldType
  required: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export type WorkOrderTypeChecklistItemInput = {
  title: string
  fieldType: ChecklistFieldType
  required: boolean
}
