import type {
  MaterialCatalogItem,
  MaterialCatalogDisplayRow,
  MaterialInventoryRow,
  MaterialStatus,
} from "@/lib/types/materials"
import { resolveStockStatus } from "@/lib/materials/stock-status"
import { formatUnitLabel } from "@/lib/materials/units"

export function materialHasInventoryHistory(
  materialId: string,
  inventory: MaterialInventoryRow[],
  materialIdsWithMovements: Set<string>
): boolean {
  if (materialIdsWithMovements.has(materialId)) {
    return true
  }
  return inventory.some((row) => row.materialId === materialId)
}

export function formatCatalogTotalStock(
  totalStock: number | null,
  unit: string
): string {
  if (totalStock === null) {
    return "Sin stock registrado"
  }
  return `${totalStock.toLocaleString("es-MX")} ${formatUnitLabel(unit)}`
}

export function resolveCatalogInventoryStatus(
  item: MaterialCatalogItem,
  totalStock: number | null
): MaterialStatus | "no-inventory" {
  if (totalStock === null) {
    return "no-inventory"
  }
  return resolveStockStatus(totalStock, item.minStock, item.active)
}

export function buildCatalogDisplayRows(
  catalog: MaterialCatalogItem[],
  inventory: MaterialInventoryRow[],
  materialIdsWithMovements: Set<string>
): MaterialCatalogDisplayRow[] {
  const stockByMaterial = new Map<string, number>()

  for (const row of inventory) {
    stockByMaterial.set(
      row.materialId,
      (stockByMaterial.get(row.materialId) ?? 0) + row.quantityAvailable
    )
  }

  return catalog
    .map((item) => {
      const hasHistory = materialHasInventoryHistory(
        item.id,
        inventory,
        materialIdsWithMovements
      )
      const totalStock = hasHistory
        ? (stockByMaterial.get(item.id) ?? 0)
        : null

      return {
        ...item,
        totalStock,
        inventoryStatus: resolveCatalogInventoryStatus(item, totalStock),
        hasInventoryHistory: hasHistory,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code, "es"))
}
