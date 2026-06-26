export type CreateCustomerPayload = {
  customerNumber: string
  name: string
  externalCustomerCode?: string | null
  dni?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  locality?: string | null
  technology?: string | null
  contractedPlan?: string | null
  latitude?: number | null
  longitude?: number | null
  sharedLocation?: string | null
  napBox?: string | null
  napPort?: string | null
  onuSerial?: string | null
  statusReason?: string | null
  status?: string
  validationStatus?: "active" | "review"
  legacyClientState?: string | null
  legacyMigrationId?: number | null
}

export type UpdateCustomerPayload = Partial<{
  customerNumber: string
  name: string
  externalCustomerCode: string | null
  dni: string | null
  phone: string | null
  email: string | null
  address: string | null
  locality: string | null
  technology: string | null
  contractedPlan: string | null
  latitude: number | null
  longitude: number | null
  sharedLocation: string | null
  napBox: string | null
  napPort: string | null
  onuSerial: string | null
  statusReason: string | null
  status: string
  validationStatus: "active" | "review"
  validatedBy: string | null
  validatedAt: string | null
  legacyClientState: string | null
  legacyMigrationId: number | null
  deletedAt: string | null
}>

export type CustomersRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_NUMBER"
  | "HAS_ASSOCIATED_TASKS"
  | "HAS_OPERATIONAL_ACTIVITY"
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
