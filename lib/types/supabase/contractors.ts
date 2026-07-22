import type { Contractor, ContractorStatus } from "@/lib/types/contractors"

export type CreateContractorPayload = {
  companyId?: string
  legalName: string
  tradeName?: string
  taxId: string
  responsibleName?: string
  phone?: string
  email?: string
  status?: ContractorStatus
  notes?: string
}

export type UpdateContractorPayload = Partial<{
  legalName: string
  tradeName: string
  taxId: string
  responsibleName: string
  phone: string
  email: string
  status: ContractorStatus
  notes: string
}>

export type ContractorsRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_TAX_ID"
  | "VALIDATION"
  | "UNKNOWN"

export type ContractorsRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: ContractorsRepositoryErrorCode
        message: string
      }
    }

export type ContractorRowMapped = Contractor
