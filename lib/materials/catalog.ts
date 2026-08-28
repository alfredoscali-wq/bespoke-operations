import type {
  MaterialCatalogItem,
  MaterialInventoryRow,
} from "@/lib/types/materials"

export type MaterialCatalogOption = {
  id: string
  code: string
  name: string
  unit: string
  manufacturer: string
  category: MaterialCatalogItem["category"]
  itemType: MaterialCatalogItem["itemType"]
  minStock: number
}

export function catalogItemsToOptions(
  items: MaterialCatalogItem[]
): MaterialCatalogOption[] {
  return items
    .filter((item) => item.active)
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      unit: item.unit,
      manufacturer: item.manufacturer,
      category: item.category,
      itemType: item.itemType,
      minStock: item.minStock,
    }))
    .sort((a, b) => a.code.localeCompare(b.code, "es"))
}

export function inventoryToCatalogOptions(
  rows: MaterialInventoryRow[]
): MaterialCatalogOption[] {
  const byId = new Map<string, MaterialCatalogOption>()

  for (const row of rows) {
    if (!row.active) continue
    if (!byId.has(row.materialId)) {
      byId.set(row.materialId, {
        id: row.materialId,
        code: row.code,
        name: row.name,
        unit: row.unit,
        manufacturer: row.manufacturer,
        category: row.category,
        itemType: row.itemType,
        minStock: row.minStock,
      })
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.code.localeCompare(b.code, "es")
  )
}

export function filterCatalogOptions(
  options: MaterialCatalogOption[],
  query: string
): MaterialCatalogOption[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return options

  return options.filter((option) => {
    return (
      option.code.toLowerCase().includes(normalized) ||
      option.name.toLowerCase().includes(normalized) ||
      option.manufacturer.toLowerCase().includes(normalized)
    )
  })
}

export function getInventoryStockForWarehouse(
  inventory: MaterialInventoryRow[],
  materialId: string,
  warehouseId: string
): number {
  const row = inventory.find(
    (item) =>
      item.materialId === materialId && item.warehouseId === warehouseId
  )
  return row?.quantityAvailable ?? 0
}
