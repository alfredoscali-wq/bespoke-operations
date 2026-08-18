/**
 * Tesorería 3.4 — single active Historial filter + category summary.
 * Reuses period KPIs, composition buckets and Dinero en Caja rules.
 */

import {
  formatTreasuryCategoryKeyLabel,
  TREASURY_MOVEMENT_TYPES,
  TREASURY_STATUSES,
} from "@/lib/tesoreria/categories"
import {
  isTreasuryPhysicalCashExpense,
  isTreasuryPhysicalCashIncome,
  resolveTreasuryIncomeCompositionBucket,
  TREASURY_PAYMENT_METHOD_KPI_LABELS,
  type TreasuryPaymentMethodKpiKey,
} from "@/lib/tesoreria/ot-rendition-payment-kpis"
import {
  filterTreasuryMovementsByRange,
  formatTreasuryHistoryRangeLabel,
} from "@/lib/tesoreria/summary"
import type {
  TreasuryHistoryRange,
  TreasuryMovement,
} from "@/lib/types/tesoreria"

export type TreasuryHistoryFilter =
  | { type: "none" }
  | { type: "income" }
  | { type: "expense" }
  | { type: "withdrawal" }
  | { type: "periodBalance" }
  | { type: "cashInBox" }
  | { type: "pendingRendition" }
  | { type: "paymentMethod"; key: TreasuryPaymentMethodKpiKey }
  | { type: "category"; category: string }

export const TREASURY_HISTORY_FILTER_NONE: TreasuryHistoryFilter = {
  type: "none",
}

export type TreasuryCategorySummaryRow = {
  category: string
  label: string
  income: number
  expense: number
  net: number
}

export function treasuryHistoryFiltersEqual(
  a: TreasuryHistoryFilter,
  b: TreasuryHistoryFilter
): boolean {
  if (a.type !== b.type) return false
  if (a.type === "paymentMethod" && b.type === "paymentMethod") {
    return a.key === b.key
  }
  if (a.type === "category" && b.type === "category") {
    return a.category === b.category
  }
  return true
}

export function resolveTreasuryHistoryFilterSelection(
  current: TreasuryHistoryFilter,
  next: TreasuryHistoryFilter,
  mode: "toggle" | "replace"
): TreasuryHistoryFilter {
  if (mode === "replace") return next
  if (treasuryHistoryFiltersEqual(current, next)) {
    return TREASURY_HISTORY_FILTER_NONE
  }
  return next
}

function isPresentMovement(
  movement: Pick<TreasuryMovement, "deletedAt">
): boolean {
  return !movement.deletedAt
}

function isConfirmedPresentMovement(
  movement: Pick<TreasuryMovement, "status" | "deletedAt">
): boolean {
  return (
    isPresentMovement(movement) &&
    movement.status === TREASURY_STATUSES.CONFIRMED
  )
}

export function applyTreasuryHistoryFilter(
  movements: ReadonlyArray<TreasuryMovement>,
  filter: TreasuryHistoryFilter,
  range: TreasuryHistoryRange,
  reference = new Date()
): TreasuryMovement[] {
  const present = movements.filter(isPresentMovement)

  if (filter.type === "none") {
    return filterTreasuryMovementsByRange(present, range, reference)
  }

  if (filter.type === "pendingRendition") {
    return []
  }

  const scopedRange: TreasuryHistoryRange =
    filter.type === "cashInBox" ? "month" : range
  const inRange = filterTreasuryMovementsByRange(
    present,
    scopedRange,
    reference
  )
  const confirmed = inRange.filter(isConfirmedPresentMovement)

  if (filter.type === "income") {
    return confirmed.filter(
      (movement) => movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME
    )
  }

  if (filter.type === "expense") {
    return confirmed.filter(
      (movement) => movement.movementType === TREASURY_MOVEMENT_TYPES.EXPENSE
    )
  }

  if (filter.type === "withdrawal") {
    return confirmed.filter(
      (movement) =>
        movement.movementType === TREASURY_MOVEMENT_TYPES.WITHDRAWAL
    )
  }

  if (filter.type === "periodBalance") {
    return confirmed.filter(
      (movement) =>
        movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME ||
        movement.movementType === TREASURY_MOVEMENT_TYPES.EXPENSE ||
        movement.movementType === TREASURY_MOVEMENT_TYPES.WITHDRAWAL
    )
  }

  if (filter.type === "cashInBox") {
    return confirmed.filter(
      (movement) =>
        isTreasuryPhysicalCashIncome(movement) ||
        isTreasuryPhysicalCashExpense(movement) ||
        movement.movementType === TREASURY_MOVEMENT_TYPES.WITHDRAWAL
    )
  }

  if (filter.type === "paymentMethod") {
    const key = filter.key
    return confirmed.filter(
      (movement) =>
        movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME &&
        resolveTreasuryIncomeCompositionBucket(movement) === key
    )
  }

  return confirmed.filter(
    (movement) =>
      (movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME ||
        movement.movementType === TREASURY_MOVEMENT_TYPES.EXPENSE) &&
      movement.category === filter.category
  )
}

export function buildTreasuryCategorySummary(
  movements: ReadonlyArray<TreasuryMovement>,
  range: TreasuryHistoryRange,
  reference = new Date()
): TreasuryCategorySummaryRow[] {
  const inRange = filterTreasuryMovementsByRange(
    movements.filter(isPresentMovement),
    range,
    reference
  )
  const totals = new Map<string, { income: number; expense: number }>()

  for (const movement of inRange) {
    if (!isConfirmedPresentMovement(movement)) continue
    if (movement.movementType === TREASURY_MOVEMENT_TYPES.WITHDRAWAL) {
      continue
    }
    if (
      movement.movementType !== TREASURY_MOVEMENT_TYPES.INCOME &&
      movement.movementType !== TREASURY_MOVEMENT_TYPES.EXPENSE
    ) {
      continue
    }

    const current = totals.get(movement.category) ?? { income: 0, expense: 0 }
    if (movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME) {
      current.income += movement.amount
    } else {
      current.expense += movement.amount
    }
    totals.set(movement.category, current)
  }

  return [...totals.entries()]
    .map(([category, amounts]) => ({
      category,
      label: formatTreasuryCategoryKeyLabel(category),
      income: amounts.income,
      expense: amounts.expense,
      net: amounts.income - amounts.expense,
    }))
    .sort((left, right) => {
      const leftVolume = Math.abs(left.income) + Math.abs(left.expense)
      const rightVolume = Math.abs(right.income) + Math.abs(right.expense)
      if (rightVolume !== leftVolume) return rightVolume - leftVolume
      return left.label.localeCompare(right.label, "es")
    })
}

export function sumTreasuryCategorySummary(
  rows: ReadonlyArray<Pick<TreasuryCategorySummaryRow, "income" | "expense">>
): { income: number; expense: number } {
  return rows.reduce(
    (totals, row) => ({
      income: totals.income + row.income,
      expense: totals.expense + row.expense,
    }),
    { income: 0, expense: 0 }
  )
}

export function formatTreasuryHistoryFilterBanner(
  filter: TreasuryHistoryFilter,
  range: TreasuryHistoryRange
): string | null {
  if (filter.type === "none") return null

  const period = formatTreasuryHistoryRangeLabel(range)

  if (filter.type === "income") return `Mostrando: Ingresos · ${period}`
  if (filter.type === "expense") return `Mostrando: Egresos · ${period}`
  if (filter.type === "withdrawal") return `Mostrando: Retiros · ${period}`
  if (filter.type === "periodBalance") {
    return `Mostrando: Saldo del Período · ${period}`
  }
  if (filter.type === "cashInBox") return "Mostrando: Dinero en Caja · Mes"
  if (filter.type === "pendingRendition") {
    return "Mostrando: Pendientes de Rendición"
  }
  if (filter.type === "paymentMethod") {
    return `Mostrando: ${TREASURY_PAYMENT_METHOD_KPI_LABELS[filter.key]} · ${period}`
  }
  return `Mostrando: ${formatTreasuryCategoryKeyLabel(filter.category)} · ${period}`
}
