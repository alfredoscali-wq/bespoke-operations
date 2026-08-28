import type { Warehouse, WarehouseSelectionContext } from "@/lib/types/materials"

export type WarehousePickerMode = "none" | "auto" | "manual"

export function resolveWarehousePickerMode(
  warehouses: Warehouse[]
): WarehousePickerMode {
  if (warehouses.length === 0) return "none"
  if (warehouses.length === 1) return "auto"
  return "manual"
}

export function buildWarehouseSelectionContext(
  warehouses: Warehouse[]
): WarehouseSelectionContext {
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.active)
  const mode = resolveWarehousePickerMode(activeWarehouses)

  return {
    warehouses: activeWarehouses,
    mode: mode === "manual" ? "manual" : "auto",
    defaultWarehouseId:
      activeWarehouses.length === 1 ? activeWarehouses[0].id : null,
  }
}

export function mergeWarehouseFilterOptions(
  inventoryWarehouseNames: string[],
  context: WarehouseSelectionContext | null
): string[] {
  const fromContext = context?.warehouses.map((warehouse) => warehouse.name) ?? []
  return Array.from(
    new Set([...fromContext, ...inventoryWarehouseNames])
  ).sort((a, b) => a.localeCompare(b, "es"))
}
