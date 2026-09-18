import {
  TREASURY_MOVEMENT_TYPES,
  TREASURY_ORIGINS,
  TREASURY_STATUSES,
} from "@/lib/tesoreria/categories"
import type { CreateTreasuryMovementInput } from "@/lib/types/tesoreria"

/** Income category for operational cash-box corrections. Never cobranza OT. */
export const TREASURY_CASH_BALANCE_ADJUSTMENT_CATEGORY = "ajuste_saldo" as const

export const TREASURY_CASH_BALANCE_ADJUSTMENT_SOURCE =
  "cash_balance_adjustment" as const

export const TREASURY_CASH_BALANCE_ADJUSTMENT_LABEL = "Ajuste de saldo"

export function isTreasuryCashBalanceAdjustmentCategory(
  category: string | null | undefined
): boolean {
  return category === TREASURY_CASH_BALANCE_ADJUSTMENT_CATEGORY
}

/**
 * Cash-box adjustment is physical cash. Dinero en Caja only counts explicit
 * efectivo incomes; this metadata is required for the KPI to move.
 */
export function buildTreasuryCashBalanceAdjustmentMetadata(): Record<
  string,
  string
> {
  return {
    source: TREASURY_CASH_BALANCE_ADJUSTMENT_SOURCE,
    paymentMethodReceived: "efectivo",
    paymentMethod: "efectivo",
  }
}

export function buildTreasuryCashBalanceAdjustmentInput(input: {
  companyId: string
  amount: number
  movementDate: string
  notes?: string
  registeredBy?: string | null
}): CreateTreasuryMovementInput {
  return {
    companyId: input.companyId,
    movementType: TREASURY_MOVEMENT_TYPES.INCOME,
    origin: TREASURY_ORIGINS.ADMINISTRATION,
    category: TREASURY_CASH_BALANCE_ADJUSTMENT_CATEGORY,
    amount: input.amount,
    movementDate: input.movementDate,
    registeredBy: input.registeredBy ?? null,
    status: TREASURY_STATUSES.CONFIRMED,
    notes:
      input.notes?.trim() ||
      "Ajuste de saldo de caja. No corresponde a cobranza de OT.",
    metadata: buildTreasuryCashBalanceAdjustmentMetadata(),
  }
}
