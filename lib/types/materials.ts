export type MaterialCategory =
  | "fiber-optic"
  | "cameras"
  | "wireless"
  | "pole-infrastructure"
  | "network-equipment"
  | "consumables"

export type MaterialItemType = "consumable" | "equipment"

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
  | "return"

export type DbMovementType =
  | "entry"
  | "exit"
  | "transfer"
  | "adjustment"
  | "consumption"
  | "return"

export type AssignmentStatus = "assigned" | "in-use" | "consumed" | "returned"

export type Warehouse = {
  id: string
  companyId: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Row in inventory list: one material in one warehouse. */
export type MaterialInventoryRow = {
  stockLevelId: string
  materialId: string
  warehouseId: string
  code: string
  name: string
  category: MaterialCategory
  itemType: MaterialItemType
  unit: string
  minStock: number
  quantityAvailable: number
  quantityReserved: number
  netAvailable: number
  warehouse: string
  status: MaterialStatus
  manufacturer: string
  description: string
  active: boolean
  /** True when stock level row is not persisted yet (orphan material). */
  isSynthetic?: boolean
  photoAttachmentId?: string | null
}

/** Material catalog record (without warehouse context). */
export type MaterialCatalogItem = {
  id: string
  companyId: string
  code: string
  name: string
  category: MaterialCategory
  itemType: MaterialItemType
  unit: string
  minStock: number
  manufacturer: string
  description: string
  active: boolean
  createdAt: string
  updatedAt: string
  photoAttachmentId?: string | null
}

/** Catalog list row with aggregated inventory context. */
export type MaterialCatalogDisplayRow = MaterialCatalogItem & {
  totalStock: number | null
  inventoryStatus: MaterialStatus | "no-inventory"
  hasInventoryHistory: boolean
}

/** Legacy shape used by some panels; maps from inventory row when possible. */
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
  itemType?: MaterialItemType
  stockLevelId?: string
  warehouseId?: string
  materialId?: string
  quantityReserved?: number
  netAvailable?: number
}

export type MaterialMovement = {
  id: string
  materialId: string
  type: MovementType
  quantity: number
  timestamp: string
  user: string
  warehouseId: string
  warehouseName: string
  destinationWarehouseId?: string
  destinationWarehouseName?: string
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
  activeReservations: MaterialActiveReservation[]
  history: MaterialHistoryEvent[]
  stats: {
    assignedQuantity: number
    totalMovements: number
    lastMovementAt: string | null
    totalReserved: number
  }
}

export type MaterialsSummary = {
  totalMaterials: number
  lowStockItems: number
  todaysMovements: number
  reservedQuantity: number
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

export type TaskMaterialLineStatus =
  | "planned"
  | "reserved"
  | "consumed"
  | "cancelled"

export type TaskMaterialLine = {
  id: string
  companyId: string
  taskId: string
  materialId: string
  warehouseId: string
  quantityPlanned: number
  quantityConsumed: number | null
  quantityReturned: number | null
  unit: string
  notes: string | null
  status: TaskMaterialLineStatus
  materialsConfirmedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Line with joined catalog / warehouse labels for UI. */
export type TaskMaterialLineView = TaskMaterialLine & {
  materialCode: string
  materialName: string
  warehouseName: string
  quantityAvailable: number | null
  quantityReserved: number | null
  netAvailable: number | null
  /** Reserved amount for this line when status is reserved/consumed. */
  quantityReservedForLine: number | null
}

export type MaterialActiveReservation = {
  id: string
  taskId: string
  taskCode: string
  taskTitle: string
  customerLabel: string
  quantity: number
  unit: string
  warehouseId: string
  warehouseName: string
  status: TaskMaterialLineStatus
}

export type TaskMaterialLineDraft = {
  clientKey: string
  materialId: string
  warehouseId: string
  quantityPlanned: number
  unit: string
  notes?: string | null
}

export type WarehouseSelectionMode = "auto" | "manual"

export type WarehouseSelectionContext = {
  warehouses: Warehouse[]
  mode: WarehouseSelectionMode
  defaultWarehouseId: string | null
}
