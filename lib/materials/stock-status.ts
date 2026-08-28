import type { MaterialStatus } from "@/lib/types/materials"

export function computeNetAvailable(
  quantityAvailable: number,
  quantityReserved: number
): number {
  return Math.max(quantityAvailable - quantityReserved, 0)
}

export function resolveStockStatus(
  quantityAvailable: number,
  minStock: number,
  active: boolean
): MaterialStatus {
  if (!active) return "discontinued"
  if (quantityAvailable === 0) return "out-of-stock"
  if (quantityAvailable <= minStock) return "low-stock"
  return "available"
}
