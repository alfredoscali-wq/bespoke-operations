export type CreateCustomerPayload = {
  customerNumber: string
  name: string
  externalCustomerCode?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  locality?: string | null
  technology?: string | null
  status?: string
}

export type UpdateCustomerPayload = Partial<{
  customerNumber: string
  name: string
  externalCustomerCode: string | null
  phone: string | null
  email: string | null
  address: string | null
  locality: string | null
  technology: string | null
  status: string
  deletedAt: string | null
}>

export type CustomersRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_NUMBER"
  | "HAS_ASSOCIATED_TASKS"
  | "VALIDATION"
  | "UNKNOWN"

export type CustomersRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: null; ok: true }
  | {
      data: null
      error: {
        code: CustomersRepositoryErrorCode
        message: string
      }
    }
