import type { MaterialCategory, MaterialItemType } from "@/lib/types/materials"

export type CreateMaterialPayload = {
  code: string
  name: string
  category: MaterialCategory
  unit: string
  minStock?: number
  type?: MaterialItemType
  manufacturer?: string
  description?: string
  active?: boolean
}

export type UpdateMaterialPayload = {
  code?: string
  name?: string
  category?: MaterialCategory
  unit?: string
  minStock?: number
  type?: MaterialItemType
  manufacturer?: string
  description?: string
  active?: boolean
  photoAttachmentId?: string | null
  clearPhoto?: boolean
}

export type CreateWarehousePayload = {
  name: string
}

export type UpdateWarehousePayload = {
  name?: string
  active?: boolean
}

export type RecordMaterialMovementPayload = {
  materialId: string
  warehouseId: string
  quantity: number
  notes?: string
  destinationWarehouseId?: string
  newQuantity?: number
  movementType: "entry" | "exit" | "transfer" | "adjustment"
}

export type MaterialsRepositoryError = {
  code: "VALIDATION" | "NOT_FOUND" | "DUPLICATE" | "UNKNOWN"
  message: string
}

export type MaterialsRepositoryResult<T> = {
  data: T | null
  error: MaterialsRepositoryError | null
}
