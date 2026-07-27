import type {
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
  address: string
  city: string
  province: string
  postalCode: string
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
