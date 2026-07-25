import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_IMPACTS,
  ACTIVITY_ORIGINS,
  type ActivityCategory,
  type ActivityImpact,
  type ActivityOrigin,
} from "@/lib/activity-engine/activity-types"

export const CUSTOMER_SERVICE_ACTIVITY_MODULE = "customer_service"
export const CUSTOMER_SERVICE_ACTIVITY_ENTITY_TYPE = "customer_atencion"

export type RegisterCustomerActivityInput = {
  companyId: string
  entityId: string
  employeeId?: string | null
  action: string
  category?: ActivityCategory
  impact?: ActivityImpact
  origin?: ActivityOrigin
  title?: string | null
  description?: string | null
  metadata?: Record<string, unknown>
}

export const CUSTOMER_ACTIVITY_DEFAULTS = {
  category: ACTIVITY_CATEGORIES.FOLLOW_UP,
  impact: ACTIVITY_IMPACTS.ACTIVITY,
  origin: ACTIVITY_ORIGINS.USER,
} as const
