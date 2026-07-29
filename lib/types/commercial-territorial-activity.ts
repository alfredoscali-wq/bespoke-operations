export type CommercialTerritorialActivityType = {
  id: string
  companyId: string
  name: string
  color: string
  /** Reserved for future marker icons; unused in 1.0 UI. */
  icon: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateCommercialTerritorialActivityTypeInput = {
  name: string
  color?: string
  icon?: string | null
  sortOrder?: number
  isActive?: boolean
}

export type UpdateCommercialTerritorialActivityTypeInput = {
  name?: string
  color?: string
  icon?: string | null
  sortOrder?: number
  isActive?: boolean
}

export type CommercialTerritorialActivity = {
  id: string
  companyId: string
  code: string
  activityTypeId: string
  activityTypeName: string | null
  activityTypeColor: string | null
  activityTypeIcon: string | null
  description: string
  observations: string
  latitude: number
  longitude: number
  locationSource: string | null
  /** Prepared for future Cliente link; unused in 1.0. */
  relatedOpportunityId: string | null
  employeeId: string | null
  employeeName: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  photoCount?: number
}

export type CreateCommercialTerritorialActivityInput = {
  activityTypeId: string
  description: string
  observations?: string
  latitude: number
  longitude: number
  locationSource?: string | null
  /** Reserved; do not send from 1.0 UI. */
  relatedOpportunityId?: string | null
}

export type CommercialTerritorialActivityMapBounds = {
  north: number
  south: number
  east: number
  west: number
}
