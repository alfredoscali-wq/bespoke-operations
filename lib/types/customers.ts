export interface Customer {
  id: string
  customerNumber: string
  externalCustomerCode?: string

  name: string
  phone?: string
  email?: string

  address?: string
  locality?: string

  technology?: string

  status: string

  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type NewCustomerInput = {
  name: string
  externalCustomerCode?: string
  phone?: string
  email?: string
  address?: string
  locality?: string
  technology?: string
  status?: string
}

export type UpdateCustomerInput = Partial<NewCustomerInput>
