import type {
  CommercialLocationSource,
  CommercialPersonType,
  CommercialPriorityCode,
  CommercialSourceCode,
  CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import type {
  CommercialMapOpportunity,
  CommercialOpportunity,
  CommercialPerson,
} from "@/lib/types/commercial"

export type CreateCommercialPersonPayload = {
  companyId?: string
  personType?: CommercialPersonType
  firstName?: string
  lastName?: string
  companyName?: string
  documentNumber?: string
  taxId?: string
  phone?: string
  mobile?: string
  email?: string
  street?: string
  streetNumber?: string
  floor?: string
  apartment?: string
  neighborhood?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  latitude?: number | null
  longitude?: number | null
  locationSource?: CommercialLocationSource | null
  notes?: string
  createdBy?: string | null
}

export type UpdateCommercialPersonPayload = Partial<{
  personType: CommercialPersonType
  firstName: string
  lastName: string
  companyName: string
  documentNumber: string
  taxId: string
  phone: string
  mobile: string
  email: string
  street: string
  streetNumber: string
  floor: string
  apartment: string
  neighborhood: string
  address: string
  city: string
  province: string
  postalCode: string
  latitude: number | null
  longitude: number | null
  locationSource: CommercialLocationSource | null
  notes: string
  updatedBy: string | null
}>

export type CreateCommercialOpportunityPayload = {
  companyId?: string
  personId: string
  title: string
  status?: CommercialStatusCode
  priority?: CommercialPriorityCode
  source?: CommercialSourceCode
  assignedEmployeeId?: string | null
  estimatedAmount?: number | null
  probability?: number | null
  expectedCloseDate?: string | null
  description?: string
  lostReason?: string
  latitude?: number | null
  longitude?: number | null
  locationSource?: CommercialLocationSource | null
  createdBy?: string | null
  /** Leave empty to auto-generate OP-###### via DB trigger. */
  code?: string
}

export type UpdateCommercialOpportunityPayload = Partial<{
  personId: string
  title: string
  status: CommercialStatusCode
  priority: CommercialPriorityCode
  source: CommercialSourceCode
  assignedEmployeeId: string | null
  estimatedAmount: number | null
  probability: number | null
  expectedCloseDate: string | null
  description: string
  lostReason: string
  latitude: number | null
  longitude: number | null
  locationSource: CommercialLocationSource | null
  updatedBy: string | null
}>

export type BulkAssignCommercialOpportunitiesPayload = {
  opportunityIds: string[]
  assignedEmployeeId: string | null
  updatedBy?: string | null
}

export type CommercialRepositoryErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "FORBIDDEN"
  | "UNKNOWN"

export type CommercialRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CommercialRepositoryErrorCode
        message: string
      }
    }

export type CommercialPersonRowMapped = CommercialPerson
export type CommercialOpportunityRowMapped = CommercialOpportunity
export type CommercialMapOpportunityMapped = CommercialMapOpportunity
