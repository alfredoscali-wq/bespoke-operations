/**
 * Tenant-configurable employee type catalog for HR classification.
 */
export type EmployeeTypeCatalog = {
  id: string
  companyId: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type EmployeeTypeCatalogInput = {
  name: string
  description: string
  isActive: boolean
}
