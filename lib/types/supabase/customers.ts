export type CreateCustomerPayload = {
  customerNumber: string
  name: string
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
  phone: string | null
  email: string | null
  address: string | null
  locality: string | null
  technology: string | null
  status: string
}>

export type CustomersRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_NUMBER"
  | "VALIDATION"
  | "UNKNOWN"

export type CustomersRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: CustomersRepositoryErrorCode
        message: string
      }
    }
