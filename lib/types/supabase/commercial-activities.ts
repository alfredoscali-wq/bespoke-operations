import type {
  CommercialActivityStatus,
  CommercialActivityTypeCode,
} from "@/lib/commercial/activity-catalogs"
import type {
  CommercialActivity,
  CommercialActivityListItem,
} from "@/lib/types/commercial-activities"
import type { CommercialRepositoryErrorCode } from "@/lib/types/supabase/commercial"

export type CreateCommercialActivityPayload = {
  companyId?: string
  opportunityId: string
  activityTypeId?: string
  activityTypeCode?: CommercialActivityTypeCode
  employeeId?: string | null
  title: string
  description?: string
  scheduledAt?: string | null
  completedAt?: string | null
  status?: CommercialActivityStatus
  metadata?: Record<string, unknown>
  createdBy?: string | null
  /** Compromiso futuro asociado (Parte 2 — no mezclar con la actividad). */
  commitment?: {
    title: string
    description?: string
    assignedEmployeeId?: string | null
    dueAt: string
    priority?: "alta" | "media" | "baja"
  } | null
}

export type UpdateCommercialActivityPayload = Partial<{
  activityTypeId: string
  activityTypeCode: CommercialActivityTypeCode
  employeeId: string | null
  title: string
  description: string
  scheduledAt: string | null
  completedAt: string | null
  status: CommercialActivityStatus
  metadata: Record<string, unknown>
  updatedBy: string | null
}>

export type CommercialActivityRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CommercialRepositoryErrorCode
        message: string
      }
    }

export type CommercialActivityRowMapped = CommercialActivity
export type CommercialActivityListItemMapped = CommercialActivityListItem
