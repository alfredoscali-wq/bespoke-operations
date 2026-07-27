import type {
  CommercialLocationSource,
  CommercialPersonType,
  CommercialPriorityCode,
  CommercialSourceCode,
  CommercialStatusCode,
} from "@/lib/commercial/catalogs"

export type CommercialPerson = {
  id: string
  companyId: string
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
  createdBy: string | null
  updatedBy: string | null
  deletedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CommercialOpportunity = {
  id: string
  companyId: string
  personId: string
  code: string
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
  sellerOpenedAt: string | null
  sourceAtencionId: string | null
  sourceCustomerId: string | null
  createdBy: string | null
  updatedBy: string | null
  deletedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  /** Optional joined display fields for inbox/list. */
  personDisplayName?: string | null
  assignedEmployeeName?: string | null
}

export type CommercialOpportunityListItem = CommercialOpportunity & {
  personDisplayName: string
}

export type CommercialMapOpportunity = {
  id: string
  code: string
  title: string
  status: CommercialStatusCode
  priority: CommercialPriorityCode
  latitude: number
  longitude: number
  assignedEmployeeId: string | null
  personName: string
  companyName: string
  updatedAt: string
}

export type CommercialMapBounds = {
  north: number
  south: number
  east: number
  west: number
}

export type CommercialMapAssignmentFilter = "all" | "assigned" | "unassigned"

export type CommercialMapQuery = {
  bounds: CommercialMapBounds
  assignment?: CommercialMapAssignmentFilter
  assignedEmployeeId?: string | null
  status?: CommercialStatusCode | null
  priority?: CommercialPriorityCode | null
  source?: CommercialSourceCode | null
  search?: string | null
}
