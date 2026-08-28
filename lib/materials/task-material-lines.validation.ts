import { formatUnitLabel, isIntegerOnlyUnit, normalizeMaterialUnit } from "@/lib/materials/units"
import { formatInsufficientStockMessage } from "@/lib/materials/reservation-status"

export type TaskMaterialLineQuantityValidation =
  | { ok: true; quantity: number }
  | { ok: false; message: string }

export function validateTaskMaterialLineQuantity(
  unit: string,
  rawQuantity: string | number
): TaskMaterialLineQuantityValidation {
  const quantity =
    typeof rawQuantity === "number"
      ? rawQuantity
      : Number.parseFloat(String(rawQuantity).trim().replace(",", "."))

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: "La cantidad debe ser mayor a cero." }
  }

  if (isIntegerOnlyUnit(unit) && !Number.isInteger(quantity)) {
    return {
      ok: false,
      message: `Para ${formatUnitLabel(unit)} la cantidad debe ser un número entero.`,
    }
  }

  return { ok: true, quantity }
}

export function buildInsufficientStockWarning(input: {
  quantityPlanned: number
  netAvailable: number
  unit: string
}): string | null {
  const { quantityPlanned, netAvailable } = input
  if (netAvailable >= quantityPlanned) {
    return null
  }

  return formatInsufficientStockMessage({
    available: netAvailable,
    requested: quantityPlanned,
  })
}

export function unitsMatchCatalog(materialUnit: string, lineUnit: string): boolean {
  return normalizeMaterialUnit(materialUnit) === normalizeMaterialUnit(lineUnit)
}
