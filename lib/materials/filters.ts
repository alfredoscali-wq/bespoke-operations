import type {
  MaterialFilters,
  MaterialInventoryRow,
  MaterialStatus,
} from "@/lib/types/materials"

export const defaultMaterialFilters: MaterialFilters = {
  search: "",
  category: "all",
  status: "all",
  warehouse: "all",
}

export function filterInventoryRows(
  rows: MaterialInventoryRow[],
  filters: MaterialFilters
): MaterialInventoryRow[] {
  const query = filters.search.trim().toLowerCase()

  return rows.filter((row) => {
    const matchesSearch =
      query === "" ||
      row.code.toLowerCase().includes(query) ||
      row.name.toLowerCase().includes(query) ||
      row.manufacturer.toLowerCase().includes(query)

    const matchesCategory =
      filters.category === "all" || row.category === filters.category

    const matchesStatus =
      filters.status === "all" || row.status === filters.status

    const matchesWarehouse =
      filters.warehouse === "all" || row.warehouse === filters.warehouse

    return matchesSearch && matchesCategory && matchesStatus && matchesWarehouse
  })
}

export function getWarehouseOptionsFromInventory(
  rows: MaterialInventoryRow[]
): string[] {
  return Array.from(new Set(rows.map((row) => row.warehouse))).sort()
}

export function countInventoryByStatus(
  rows: MaterialInventoryRow[],
  status: MaterialStatus
): number {
  return rows.filter((row) => row.status === status).length
}
