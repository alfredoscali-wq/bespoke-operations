import type {
  CommercialSourceCode,
  CommercialStatusCode,
} from "@/lib/commercial/catalogs"

export type CommercialPipelineCard = {
  id: string
  code: string
  title: string
  status: CommercialStatusCode
  source: CommercialSourceCode
  createdAt: string
  assignedEmployeeId: string | null
  personId: string
  personName: string
  companyName: string
  responsibleName: string
  lastActivityAt: string | null
  daysSinceLastActivity: number
  hasOverdueCommitment: boolean
  hasTodayCommitment: boolean
  isDerived: boolean
}

export type CommercialPipelineFilters = {
  search: string
  assignedEmployeeId: string
  status: CommercialStatusCode | ""
  source: CommercialSourceCode | ""
  personQuery: string
  companyQuery: string
  dateFrom: string
  dateTo: string
}
