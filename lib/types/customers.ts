export type CustomerValidationStatus = "active" | "review"

export interface Customer {
  id: string
  customerNumber: string
  externalCustomerCode?: string
  dni?: string

  name: string
  phone?: string
  email?: string

  address?: string
  locality?: string

  technology?: string

  /** Estado operativo interno (siempre activo para clientes operativos). */
  status: string

  validationStatus: CustomerValidationStatus
  validatedBy?: string
  validatedAt?: string
  legacyClientState?: string
  legacyMigrationId?: number

  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type NewCustomerInput = {
  name: string
  externalCustomerCode?: string
  dni?: string
  phone?: string
  email?: string
  address?: string
  locality?: string
  technology?: string
  status?: string
  validationStatus?: CustomerValidationStatus
  legacyClientState?: string
  legacyMigrationId?: number
}

export type UpdateCustomerInput = Partial<NewCustomerInput> & {
  deletedAt?: string | null
  validatedBy?: string | null
  validatedAt?: string | null
}
