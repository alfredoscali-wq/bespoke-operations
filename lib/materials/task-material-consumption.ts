import { formatUnitLabel, isIntegerOnlyUnit } from "@/lib/materials/units"
import type { TaskMaterialLineView } from "@/lib/types/materials"

/** Active catalog lines (not cancelled/consumed). Does NOT include materialsNeeded text. */
export function taskHasActiveCatalogMaterialLines(
  lines: Pick<TaskMaterialLineView, "status">[]
): boolean {
  return lines.some(
    (line) => line.status === "planned" || line.status === "reserved"
  )
}

/** Reserved lines requiring consumption confirmation at closure. */
export function taskRequiresMaterialConsumptionConfirmation(
  lines: Pick<TaskMaterialLineView, "status">[]
): boolean {
  return lines.some((line) => line.status === "reserved")
}

export function taskMaterialConsumptionIsConfirmed(
  lines: Pick<TaskMaterialLineView, "status" | "materialsConfirmedAt">[]
): boolean {
  const reserved = lines.filter((line) => line.status === "reserved")
  if (reserved.length === 0) return true
  return reserved.every((line) => Boolean(line.materialsConfirmedAt))
}

export type ConsumptionLineInput = {
  lineId: string
  quantityConsumed: number
}

export type ConsumptionQuantityValidation =
  | { ok: true; quantity: number }
  | { ok: false; message: string }

export function validateConsumedQuantity(input: {
  unit: string
  quantityReserved: number
  quantityConsumed: string | number
}): ConsumptionQuantityValidation {
  const quantity =
    typeof input.quantityConsumed === "number"
      ? input.quantityConsumed
      : Number.parseFloat(String(input.quantityConsumed).trim().replace(",", "."))

  if (!Number.isFinite(quantity) || quantity < 0) {
    return { ok: false, message: "La cantidad utilizada no puede ser negativa." }
  }

  if (isIntegerOnlyUnit(input.unit) && !Number.isInteger(quantity)) {
    return {
      ok: false,
      message: `Para ${formatUnitLabel(input.unit)} la cantidad utilizada debe ser un número entero.`,
    }
  }

  if (quantity > input.quantityReserved) {
    return {
      ok: false,
      message: `La cantidad utilizada no puede superar los ${input.quantityReserved.toLocaleString("es-AR")} ${formatUnitLabel(input.unit)} reservados.`,
    }
  }

  return { ok: true, quantity }
}

export function computeQuantityReturned(
  quantityReserved: number,
  quantityConsumed: number
): number {
  return Math.max(quantityReserved - quantityConsumed, 0)
}

export const MATERIAL_CONSUMPTION_REQUIRED_MESSAGE =
  "Debe confirmar los materiales utilizados antes de finalizar la OT."
