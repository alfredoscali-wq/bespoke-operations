import type {
  CommercialActivityStatus,
  CommercialActivityTypeCode,
} from "@/lib/commercial/activity-catalogs"

export type CommercialActivityType = {
  id: string
  code: CommercialActivityTypeCode
  label: string
  sortOrder: number
  createdAt: string
}

export type CommercialActivity = {
  id: string
  companyId: string
  opportunityId: string
  activityTypeId: string
  employeeId: string | null
  title: string
  description: string
  scheduledAt: string | null
  completedAt: string | null
  status: CommercialActivityStatus
  metadata: Record<string, unknown>
  createdBy: string | null
  updatedBy: string | null
  deletedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  activityTypeCode?: CommercialActivityTypeCode
  activityTypeLabel?: string
  employeeName?: string | null
}

export type CommercialActivityListItem = CommercialActivity & {
  activityTypeCode: CommercialActivityTypeCode
  activityTypeLabel: string
  employeeName: string | null
}
