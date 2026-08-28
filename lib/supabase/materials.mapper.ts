import { DB_MOVEMENT_TYPE_TO_UI, MOVEMENT_TYPE_LABELS } from "@/lib/materials/constants"
import {
  computeNetAvailable,
  resolveStockStatus,
} from "@/lib/materials/stock-status"
import type { Database } from "@/lib/supabase/database.types"
import type {
  MaterialCatalogItem,
  MaterialCategory,
  MaterialInventoryRow,
  MaterialItemType,
  MaterialMovement,
  Warehouse,
} from "@/lib/types/materials"

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"]
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"]
type StockLevelRow = Database["public"]["Tables"]["material_stock_levels"]["Row"]
type MovementRow = Database["public"]["Tables"]["material_movements"]["Row"]

type StockLevelWithRelations = StockLevelRow & {
  material: MaterialRow
  warehouse: WarehouseRow
}

type MovementWithRelations = MovementRow & {
  warehouse: WarehouseRow
  destination_warehouse: WarehouseRow | null
  created_by_employee: {
    first_name: string
    last_name: string
  } | null
}

function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asMaterialCategory(value: string): MaterialCategory {
  return value as MaterialCategory
}

function asMaterialItemType(value: string): MaterialItemType {
  return value as MaterialItemType
}

export function mapWarehouseRow(row: WarehouseRow): Warehouse {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMaterialCatalogRow(row: MaterialRow): MaterialCatalogItem {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    category: asMaterialCategory(row.category),
    itemType: asMaterialItemType(row.type),
    unit: row.unit,
    minStock: parseNumber(row.min_stock),
    manufacturer: row.manufacturer,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoAttachmentId: row.photo_attachment_id ?? null,
  }
}

export function mapInventoryRow(row: StockLevelWithRelations): MaterialInventoryRow {
  const quantityAvailable = parseNumber(row.quantity_available)
  const quantityReserved = parseNumber(row.quantity_reserved)
  const minStock = parseNumber(row.material.min_stock)
  const netAvailable = computeNetAvailable(quantityAvailable, quantityReserved)

  return {
    stockLevelId: row.id,
    materialId: row.material_id,
    warehouseId: row.warehouse_id,
    code: row.material.code,
    name: row.material.name,
    category: asMaterialCategory(row.material.category),
    itemType: asMaterialItemType(row.material.type),
    unit: row.material.unit,
    minStock,
    quantityAvailable,
    quantityReserved,
    netAvailable,
    warehouse: row.warehouse.name,
    status: resolveStockStatus(
      quantityAvailable,
      minStock,
      row.material.active
    ),
    manufacturer: row.material.manufacturer,
    description: row.material.description,
    active: row.material.active,
    isSynthetic: false,
    photoAttachmentId: row.material.photo_attachment_id ?? null,
  }
}

export function createSyntheticInventoryRow(
  material: MaterialRow,
  warehouse: WarehouseRow | null,
  quantityAvailable = 0,
  quantityReserved = 0
): MaterialInventoryRow {
  const minStock = parseNumber(material.min_stock)
  const netAvailable = computeNetAvailable(quantityAvailable, quantityReserved)
  const warehouseId = warehouse?.id ?? ""
  const warehouseName = warehouse?.name ?? "Sin depósito asignado"

  return {
    stockLevelId: `orphan-${material.id}-${warehouseId || "none"}`,
    materialId: material.id,
    warehouseId,
    code: material.code,
    name: material.name,
    category: asMaterialCategory(material.category),
    itemType: asMaterialItemType(material.type),
    unit: material.unit,
    minStock,
    quantityAvailable,
    quantityReserved,
    netAvailable,
    warehouse: warehouseName,
    status: resolveStockStatus(
      quantityAvailable,
      minStock,
      material.active
    ),
    manufacturer: material.manufacturer,
    description: material.description,
    active: material.active,
    isSynthetic: true,
  }
}

export function buildInventoryRowsFromStockLevels(
  stockLevels: StockLevelWithRelations[]
): MaterialInventoryRow[] {
  const rows: MaterialInventoryRow[] = []

  for (const level of stockLevels) {
    const material = level.material
    const warehouse = level.warehouse

    if (!material || !warehouse || !material.active) {
      continue
    }

    rows.push(
      mapInventoryRow({
        ...level,
        material,
        warehouse,
      })
    )
  }

  rows.sort((a, b) => {
    const byCode = a.code.localeCompare(b.code, "es")
    if (byCode !== 0) return byCode
    return a.warehouse.localeCompare(b.warehouse, "es")
  })

  return rows
}

/** @deprecated Use buildInventoryRowsFromStockLevels — catalog-only materials are excluded. */
export function buildFullInventoryRows(
  materials: MaterialRow[],
  stockLevels: StockLevelWithRelations[],
  warehouses: WarehouseRow[]
): MaterialInventoryRow[] {
  return buildInventoryRowsFromStockLevels(stockLevels)
}

export function inventoryRowToCatalog(
  row: MaterialInventoryRow,
  companyId: string
): MaterialCatalogItem {
  return {
    id: row.materialId,
    companyId,
    code: row.code,
    name: row.name,
    category: row.category,
    itemType: row.itemType,
    unit: row.unit,
    minStock: row.minStock,
    manufacturer: row.manufacturer,
    description: row.description,
    active: row.active,
    createdAt: "",
    updatedAt: "",
    photoAttachmentId: row.photoAttachmentId ?? null,
  }
}

export function mapInventoryRowToLegacyMaterial(
  row: MaterialInventoryRow
): import("@/lib/types/materials").Material {
  return {
    id: row.materialId,
    code: row.code,
    name: row.name,
    category: row.category,
    stock: row.quantityAvailable,
    minStock: row.minStock,
    unit: row.unit,
    warehouse: row.warehouse,
    status: row.status,
    description: row.description,
    manufacturer: row.manufacturer,
    itemType: row.itemType,
    stockLevelId: row.stockLevelId,
    warehouseId: row.warehouseId,
    materialId: row.materialId,
    quantityReserved: row.quantityReserved,
    netAvailable: row.netAvailable,
  }
}

function formatEmployeeName(
  employee: { first_name: string; last_name: string } | null
): string {
  if (!employee) return "Sistema"
  const name = `${employee.first_name} ${employee.last_name}`.trim()
  return name.length > 0 ? name : "Sistema"
}

function parseAdjustmentDeltaFromNotes(notes: string): number | null {
  const match = notes.match(/Ajuste:\s*([+-]?\d+(?:[.,]\d+)?)/i)
  if (!match) return null
  const normalized = match[1].replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapMovementRow(row: MovementWithRelations): MaterialMovement {
  const uiType = DB_MOVEMENT_TYPE_TO_UI[row.movement_type]
  const absQuantity = parseNumber(row.quantity)
  let signedQuantity: number

  if (row.movement_type === "exit" || row.movement_type === "transfer") {
    signedQuantity = -absQuantity
  } else if (row.movement_type === "adjustment") {
    const delta = parseAdjustmentDeltaFromNotes(row.notes)
    signedQuantity = delta ?? absQuantity
  } else {
    signedQuantity = absQuantity
  }

  return {
    id: row.id,
    materialId: row.material_id,
    type: uiType,
    quantity: signedQuantity,
    timestamp: row.created_at,
    user: formatEmployeeName(row.created_by_employee),
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse.name,
    destinationWarehouseId: row.destination_warehouse_id ?? undefined,
    destinationWarehouseName: row.destination_warehouse?.name ?? undefined,
    reference:
      row.reference_type && row.reference_id
        ? `${row.reference_type}:${row.reference_id}`
        : undefined,
    notes: row.notes.length > 0 ? row.notes : undefined,
  }
}

export function movementToHistoryEvent(
  movement: MaterialMovement
): import("@/lib/types/materials").MaterialHistoryEvent {
  const warehouseLabel =
    movement.destinationWarehouseName
      ? `${movement.warehouseName} → ${movement.destinationWarehouseName}`
      : movement.warehouseName

  return {
    id: movement.id,
    materialId: movement.materialId,
    title: MOVEMENT_TYPE_LABELS[movement.type],
    description: `${movement.quantity > 0 ? "+" : ""}${movement.quantity} · ${warehouseLabel}${movement.notes ? ` · ${movement.notes}` : ""}`,
    user: movement.user,
    timestamp: movement.timestamp,
  }
}
