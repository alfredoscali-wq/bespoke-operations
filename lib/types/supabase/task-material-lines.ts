export type TaskMaterialLineStatus = "planned" | "cancelled"

export type CreateTaskMaterialLinePayload = {
  materialId: string
  warehouseId: string
  quantityPlanned: number
  notes?: string | null
}

export type UpdateTaskMaterialLinePayload = {
  warehouseId?: string
  quantityPlanned?: number
  notes?: string | null
}

export type TaskMaterialLinesRepositoryError = {
  code:
    | "VALIDATION"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "CONFLICT"
    | "UNKNOWN"
  message: string
}

export type TaskMaterialLinesRepositoryResult<T> = {
  data: T | null
  error: TaskMaterialLinesRepositoryError | null
}
