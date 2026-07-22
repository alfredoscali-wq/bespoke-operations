export type ContractorStatus = "activo" | "inactivo"

export type Contractor = {
  id: string
  companyId: string
  legalName: string
  tradeName: string
  taxId: string
  responsibleName: string
  phone: string
  email: string
  status: ContractorStatus
  notes: string
  createdAt?: string
  updatedAt?: string
}

export type ContractorListItem = Contractor & {
  crewCount: number
  userCount: number
}

export type ContractorSummary = {
  total: number
  active: number
  inactive: number
  externalCrews: number
}

export type ContractorFilters = {
  search: string
  status: ContractorStatus | "all"
}

export type NewContractorInput = {
  legalName: string
  tradeName: string
  taxId: string
  responsibleName: string
  phone: string
  email: string
  status: ContractorStatus
  notes: string
}

export type UpdateContractorInput = Partial<NewContractorInput>
