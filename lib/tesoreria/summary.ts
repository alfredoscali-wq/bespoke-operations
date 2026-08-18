import {
  TREASURY_MOVEMENT_TYPES,
  TREASURY_ORIGINS,
  TREASURY_STATUSES,
} from "@/lib/tesoreria/categories"
import { isPendingOtRendition } from "@/lib/tesoreria/ot-rendition-status"
import type {
  TreasuryDashboardSummary,
  TreasuryHistoryRange,
  TreasuryMovement,
} from "@/lib/types/tesoreria"
import type { TreasuryOtRendition } from "@/lib/types/treasury-ot-renditions"

export const TREASURY_HISTORY_RANGE_OPTIONS: Array<{
  value: TreasuryHistoryRange
  label: string
}> = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "all", label: "Todo" },
]

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

export function isTreasuryDayKeyInRange(
  dayKey: string,
  range: TreasuryHistoryRange,
  reference = new Date()
): boolean {
  if (range === "all") return true

  const todayKey = toDayKeyFromDate(startOfLocalDay(reference))
  if (range === "today") return dayKey === todayKey

  const from =
    range === "week"
      ? startOfLocalWeek(reference)
      : startOfLocalMonth(reference)
  const fromKey = toDayKeyFromDate(from)
  return dayKey >= fromKey && dayKey <= todayKey
}

export function filterTreasuryMovementsByRange(
  movements: TreasuryMovement[],
  range: TreasuryHistoryRange,
  reference = new Date()
): TreasuryMovement[] {
  return movements.filter((movement) =>
    isTreasuryDayKeyInRange(toDayKey(movement.movementDate), range, reference)
  )
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

type PendingOtRenditionRef = Pick<
  TreasuryOtRendition,
  "id" | "taskId" | "taskCode" | "treasuryMovementId"
>

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const value = metadata?.[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

/**
 * OT pending cash is a separate stock and must never be treated as available money.
 * Used to detect confirmed incomes that still belong to a pendiente_rendicion OT.
 */
export function isTreasuryIncomeLinkedToPendingOtRendition(
  movement: Pick<
    TreasuryMovement,
    "id" | "movementType" | "origin" | "notes" | "metadata"
  >,
  pendingRenditions: ReadonlyArray<PendingOtRenditionRef>
): boolean {
  if (movement.movementType !== TREASURY_MOVEMENT_TYPES.INCOME) return false
  if (pendingRenditions.length === 0) return false

  const taskId = readMetadataString(movement.metadata, "taskId")
  const renditionId = readMetadataString(movement.metadata, "renditionId")
  const notes = movement.notes ?? ""

  return pendingRenditions.some((item) => {
    if (item.treasuryMovementId && item.treasuryMovementId === movement.id) {
      return true
    }
    if (renditionId && renditionId === item.id) return true
    if (taskId && taskId === item.taskId) return true
    if (
      movement.origin === TREASURY_ORIGINS.TASK &&
      item.taskCode.trim() &&
      notes.includes(item.taskCode.trim())
    ) {
      return true
    }
    return false
  })
}

function isConfirmedTreasuryMovement(
  movement: Pick<TreasuryMovement, "status">
): boolean {
  return movement.status === TREASURY_STATUSES.CONFIRMED
}

/** KPIs from confirmed history movements in the selected period.
 * Saldo del Período = ingresos − egresos − retiros of that same range.
 * Pending OT renditions are a separate stock and are never added here.
 */
export function buildTreasuryDashboardSummary(
  movements: TreasuryMovement[],
  reference = new Date(),
  range: TreasuryHistoryRange = "today"
): TreasuryDashboardSummary {
  let currentBalance = 0
  let income = 0
  let expense = 0
  let withdrawalPeriod = 0
  const pendingRendition = 0

  for (const movement of movements) {
    if (movement.status === TREASURY_STATUSES.CANCELLED) continue
    if (movement.status === TREASURY_STATUSES.PENDING) continue
    if (!isConfirmedTreasuryMovement(movement)) continue
    if (
      !isTreasuryDayKeyInRange(
        toDayKey(movement.movementDate),
        range,
        reference
      )
    ) {
      continue
    }

    if (movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME) {
      income += movement.amount
      currentBalance += movement.amount
      continue
    }

    if (movement.movementType === TREASURY_MOVEMENT_TYPES.WITHDRAWAL) {
      withdrawalPeriod += movement.amount
      currentBalance -= movement.amount
      continue
    }

    // Operational expense — never mixed with withdrawals or OT renditions.
    expense += movement.amount
    currentBalance -= movement.amount
  }

  return {
    currentBalance,
    income,
    expense,
    withdrawalPeriod,
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
