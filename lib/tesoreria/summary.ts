import {
  TREASURY_MOVEMENT_TYPES,
  TREASURY_STATUSES,
} from "@/lib/tesoreria/categories"
import type {
  TreasuryDashboardSummary,
  TreasuryHistoryRange,
  TreasuryMovement,
} from "@/lib/types/tesoreria"

function startOfLocalDay(reference = new Date()): Date {
  const date = new Date(reference)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfLocalWeek(reference = new Date()): Date {
  const date = startOfLocalDay(reference)
  const day = date.getDay()
  const mondayOffset = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - mondayOffset)
  return date
}

function startOfLocalMonth(reference = new Date()): Date {
  const date = startOfLocalDay(reference)
  date.setDate(1)
  return date
}

function toDayKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toDayKey(isoDate: string): string {
  return isoDate.slice(0, 10)
}

export function filterTreasuryMovementsByRange(
  movements: TreasuryMovement[],
  range: TreasuryHistoryRange,
  reference = new Date()
): TreasuryMovement[] {
  if (range === "all") return movements

  const todayKey = toDayKeyFromDate(startOfLocalDay(reference))
  const from =
    range === "today"
      ? startOfLocalDay(reference)
      : range === "week"
        ? startOfLocalWeek(reference)
        : startOfLocalMonth(reference)
  const fromKey = toDayKeyFromDate(from)

  return movements.filter((movement) => {
    const key = toDayKey(movement.movementDate)
    if (range === "today") return key === todayKey
    return key >= fromKey && key <= todayKey
  })
}

export function filterTreasuryMovementsBySearch(
  movements: TreasuryMovement[],
  search: string
): TreasuryMovement[] {
  const term = search.trim().toLowerCase()
  if (!term) return movements

  return movements.filter((movement) => {
    const haystack = [
      movement.category,
      movement.origin,
      movement.notes,
      movement.employeeName ?? "",
      movement.registeredByName ?? "",
      movement.status,
      movement.movementType,
      String(movement.amount),
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(term)
  })
}

/** Saldo / KPIs from confirmed movements only (cancelled excluded). */
export function buildTreasuryDashboardSummary(
  movements: TreasuryMovement[],
  reference = new Date()
): TreasuryDashboardSummary {
  const todayKey = toDayKeyFromDate(startOfLocalDay(reference))
  let currentBalance = 0
  let incomeToday = 0
  let expenseToday = 0
  let pendingRendition = 0

  for (const movement of movements) {
    if (movement.status === TREASURY_STATUSES.CANCELLED) continue

    if (movement.status === TREASURY_STATUSES.PENDING) {
      if (movement.movementType === TREASURY_MOVEMENT_TYPES.EXPENSE) {
        pendingRendition += movement.amount
      }
      continue
    }

    if (movement.status !== TREASURY_STATUSES.CONFIRMED) continue

    if (movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME) {
      currentBalance += movement.amount
      if (toDayKey(movement.movementDate) === todayKey) {
        incomeToday += movement.amount
      }
    } else {
      currentBalance -= movement.amount
      if (toDayKey(movement.movementDate) === todayKey) {
        expenseToday += movement.amount
      }
    }
  }

  return {
    currentBalance,
    incomeToday,
    expenseToday,
    pendingRendition,
  }
}

export function formatTreasuryAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(amount)
}
