export type CommercialEtiqueta = {
  id: string
  companyId: string
  name: string
  color: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateCommercialEtiquetaInput = {
  name: string
  color?: string
  sortOrder?: number
  isActive?: boolean
}

export type UpdateCommercialEtiquetaInput = {
  name?: string
  color?: string
  sortOrder?: number
  isActive?: boolean
}
