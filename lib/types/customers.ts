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
  contractedPlan?: string | null
  latitude?: number | null
  longitude?: number | null
  sharedLocation?: string | null
  napBox?: string | null
  napPort?: string | null
  onuSerial?: string | null
  statusReason?: string | null

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

/** Campos mínimos para filas del listado operativo. */
export type CustomerListRow = Pick<
  Customer,
  | "id"
  | "name"
  | "externalCustomerCode"
  | "dni"
  | "address"
  | "locality"
  | "email"
  | "phone"
  | "technology"
  | "validationStatus"
  | "legacyMigrationId"
>

export type CustomerListPage = {
  items: CustomerListRow[]
  total: number
  page: number
  pageSize: number
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
  contractedPlan?: string | null
  latitude?: number | null
  longitude?: number | null
  sharedLocation?: string | null
  napBox?: string | null
  napPort?: string | null
  onuSerial?: string | null
  statusReason?: string | null | null
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
