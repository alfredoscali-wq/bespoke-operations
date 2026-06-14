export type MaterialCategory =
  | "fiber-optic"
  | "cameras"
  | "wireless"
  | "pole-infrastructure"
  | "network-equipment"
  | "consumables"

export type MaterialStatus =
  | "available"
  | "low-stock"
  | "out-of-stock"
  | "discontinued"

export type MovementType =
  | "inbound"
  | "outbound"
  | "transfer"
  | "consumption"
  | "adjustment"

export type AssignmentStatus = "assigned" | "in-use" | "consumed" | "returned"

export type Material = {
  id: string
  code: string
  name: string
  category: MaterialCategory
  stock: number
  minStock: number
  unit: string
  warehouse: string
  status: MaterialStatus
  description: string
  manufacturer: string
}

export type MaterialMovement = {
  id: string
  materialId: string
  type: MovementType
  quantity: number
  timestamp: string
  user: string
  reference?: string
  projectId?: string
  projectCode?: string
  taskId?: string
  taskCode?: string
  crewId?: string
  crewName?: string
  notes?: string
}

export type MaterialAssignment = {
  id: string
  materialId: string
  projectId: string
  projectCode: string
  projectName: string
  taskId: string
  taskCode: string
  taskTitle: string
  crewId: string
  crewName: string
  quantity: number
  unit: string
  assignedAt: string
  status: AssignmentStatus
}

export type MaterialHistoryEvent = {
  id: string
  materialId: string
  title: string
  description: string
  user: string
  timestamp: string
}

export type MaterialDetail = {
  movements: MaterialMovement[]
  assignments: MaterialAssignment[]
  history: MaterialHistoryEvent[]
  stats: {
    assignedQuantity: number
    totalMovements: number
    lastMovementAt: string | null
  }
}

export type MaterialsSummary = {
  totalMaterials: number
  lowStockItems: number
  todaysMovements: number
  assignedMaterials: number
}

export type MaterialFilters = {
  search: string
  category: MaterialCategory | "all"
  status: MaterialStatus | "all"
  warehouse: string | "all"
}

export type EntityMaterialsStats = {
  totalItems: number
  totalQuantity: number
  materialCount: number
}
