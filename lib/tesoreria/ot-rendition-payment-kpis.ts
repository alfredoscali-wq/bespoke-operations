/**
 * Tesorería 3.1 — composition of confirmed period incomes by payment method.
 * OT cobranzas use payment_method_received. Manual incomes without a method → Otros.
 * Always returns all buckets, including $0.
 */

import { TREASURY_MOVEMENT_TYPES, TREASURY_STATUSES } from "@/lib/tesoreria/categories"
import {
  hasTreasuryCashOpening,
  type TreasuryCashOpening,
} from "@/lib/tesoreria/cash-opening"
import { TREASURY_OT_RENDITION_STATUSES } from "@/lib/tesoreria/ot-rendition-status"
import { isTreasuryDayKeyInRange } from "@/lib/tesoreria/summary"
import type { TreasuryHistoryRange, TreasuryMovement } from "@/lib/types/tesoreria"
import type { TreasuryOtRendition } from "@/lib/types/treasury-ot-renditions"

export const TREASURY_PAYMENT_METHOD_KPI_KEYS = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjetas",
  "cheque",
  "otro",
] as const

export type TreasuryPaymentMethodKpiKey =
  (typeof TREASURY_PAYMENT_METHOD_KPI_KEYS)[number]

export type TreasuryPaymentMethodKpi = {
  key: TreasuryPaymentMethodKpiKey
  label: string
  amount: number
}

export const TREASURY_PAYMENT_METHOD_KPI_LABELS: Record<
  TreasuryPaymentMethodKpiKey,
  string
> = {
  efectivo: "Efectivo",
  transferencia: "Transferencias",
  mercadopago: "Mercado Pago",
  tarjetas: "Tarjetas",
  cheque: "Cheques",
  otro: "Otros",
}

export const TREASURY_PAYMENT_METHOD_KPI_HINT =
  "Discriminación de los ingresos confirmados del período por medio. La suma coincide con Ingresos."

/** Canonical stored values for manual income payment method. Maps onto KPI buckets. */
export const TREASURY_INCOME_PAYMENT_METHODS = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjeta",
  "cheque",
  "otro",
] as const

export type TreasuryIncomePaymentMethod =
  (typeof TREASURY_INCOME_PAYMENT_METHODS)[number]

export const TREASURY_INCOME_PAYMENT_METHOD_OPTIONS: Array<{
  value: TreasuryIncomePaymentMethod
  label: string
}> = [
  { value: "efectivo", label: TREASURY_PAYMENT_METHOD_KPI_LABELS.efectivo },
  {
    value: "transferencia",
    label: TREASURY_PAYMENT_METHOD_KPI_LABELS.transferencia,
  },
  {
    value: "mercadopago",
    label: TREASURY_PAYMENT_METHOD_KPI_LABELS.mercadopago,
  },
  { value: "tarjeta", label: TREASURY_PAYMENT_METHOD_KPI_LABELS.tarjetas },
  { value: "cheque", label: TREASURY_PAYMENT_METHOD_KPI_LABELS.cheque },
  { value: "otro", label: TREASURY_PAYMENT_METHOD_KPI_LABELS.otro },
]

export function isTreasuryIncomePaymentMethod(
  value: string | null | undefined
): value is TreasuryIncomePaymentMethod {
  return TREASURY_INCOME_PAYMENT_METHODS.includes(
    (value?.trim() ?? "") as TreasuryIncomePaymentMethod
  )
}

export function buildTreasuryIncomePaymentMetadata(
  method: TreasuryIncomePaymentMethod
): Record<string, string> {
  return {
    paymentMethod: method,
    paymentMethodReceived: method,
  }
}

const RECEIVED_METHOD_METADATA_KEYS = [
  "paymentMethodReceived",
  "payment_method_received",
  "paymentMethod",
  "payment_method",
] as const

type RenditionPaymentSource = Pick<
  TreasuryOtRendition,
  "status" | "amount" | "collectionDate" | "paymentMethodReceived"
>

function toDayKey(isoDate: string): string {
  return isoDate.slice(0, 10)
}

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function emptyTotals(): Record<TreasuryPaymentMethodKpiKey, number> {
  return {
    efectivo: 0,
    transferencia: 0,
    mercadopago: 0,
    tarjetas: 0,
    cheque: 0,
    otro: 0,
  }
}

function toKpiList(
  totals: Record<TreasuryPaymentMethodKpiKey, number>
): TreasuryPaymentMethodKpi[] {
  return TREASURY_PAYMENT_METHOD_KPI_KEYS.map((key) => ({
    key,
    label: TREASURY_PAYMENT_METHOD_KPI_LABELS[key],
    amount: totals[key],
  }))
}

/** Map received method → KPI bucket. Debito/credito/tarjeta → Tarjetas. */
export function resolveTreasuryPaymentMethodKpiBucket(
  method: string | null | undefined
): TreasuryPaymentMethodKpiKey | null {
  const trimmed = method?.trim() ?? ""
  if (!trimmed) return null

  if (trimmed === "efectivo") return "efectivo"
  if (trimmed === "transferencia") return "transferencia"
  if (trimmed === "mercadopago" || trimmed === "mercado_pago") {
    return "mercadopago"
  }
  if (
    trimmed === "debito" ||
    trimmed === "credito" ||
    trimmed === "tarjeta"
  ) {
    return "tarjetas"
  }
  if (trimmed === "cheque") return "cheque"
  if (trimmed === "otro") return "otro"

  return null
}

/**
 * Existing payment-method fields on a treasury income.
 * Never reads payment_method_expected. Manual incomes typically have none → Otros.
 */
export function readTreasuryIncomeReceivedPaymentMethod(
  movement: Pick<TreasuryMovement, "metadata">
): string | null {
  const metadata = movement.metadata
  if (!metadata || typeof metadata !== "object") return null

  for (const key of RECEIVED_METHOD_METADATA_KEYS) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return null
}

export function resolveTreasuryIncomeCompositionBucket(
  movement: Pick<TreasuryMovement, "metadata">
): TreasuryPaymentMethodKpiKey {
  return (
    resolveTreasuryPaymentMethodKpiBucket(
      readTreasuryIncomeReceivedPaymentMethod(movement)
    ) ?? "otro"
  )
}

export function sumTreasuryPaymentMethodKpis(
  items: ReadonlyArray<Pick<TreasuryPaymentMethodKpi, "amount">>
): number {
  return items.reduce((sum, item) => sum + item.amount, 0)
}

/**
 * Composition of confirmed income movements in the selected period.
 * Same date range as Historial / KPI Ingresos. Unclassified incomes → Otros.
 */
export function buildTreasuryIncomeCompositionKpis(
  movements: ReadonlyArray<
    Pick<
      TreasuryMovement,
      "movementType" | "status" | "amount" | "movementDate" | "metadata"
    >
  >,
  range: TreasuryHistoryRange = "today",
  reference = new Date()
): TreasuryPaymentMethodKpi[] {
  const totals = emptyTotals()

  for (const movement of movements) {
    if (movement.status !== TREASURY_STATUSES.CONFIRMED) continue
    if (movement.movementType !== TREASURY_MOVEMENT_TYPES.INCOME) continue
    if (
      !isTreasuryDayKeyInRange(
        toDayKey(movement.movementDate),
        range,
        reference
      )
    ) {
      continue
    }

    const amount = movement.amount
    if (!Number.isFinite(amount) || amount <= 0) continue

    totals[resolveTreasuryIncomeCompositionBucket(movement)] += amount
  }

  return toKpiList(totals)
}

/**
 * OT-only composition kept for Tesorería 2.2 coverage.
 * Uses collectionDate and payment_method_received of rendida rows.
 */
export function buildOtRenditionPaymentMethodKpis(
  renditions: ReadonlyArray<RenditionPaymentSource>,
  range: TreasuryHistoryRange = "today",
  reference = new Date()
): TreasuryPaymentMethodKpi[] {
  const totals = emptyTotals()

  for (const rendition of renditions) {
    if (rendition.status !== TREASURY_OT_RENDITION_STATUSES.RENDERED) continue
    if (
      !isTreasuryDayKeyInRange(
        toDayKey(rendition.collectionDate),
        range,
        reference
      )
    ) {
      continue
    }

    const bucket = resolveTreasuryPaymentMethodKpiBucket(
      rendition.paymentMethodReceived
    )
    if (!bucket) continue

    const amount = rendition.amount
    if (!Number.isFinite(amount) || amount <= 0) continue

    totals[bucket] += amount
  }

  return toKpiList(totals)
}

type CashMovementSource = Pick<
  TreasuryMovement,
  "movementType" | "status" | "amount" | "movementDate" | "metadata"
>

function isExplicitEfectivoPaymentMethod(
  movement: Pick<TreasuryMovement, "metadata">
): boolean {
  return (
    resolveTreasuryPaymentMethodKpiBucket(
      readTreasuryIncomeReceivedPaymentMethod(movement)
    ) === "efectivo"
  )
}

export function isTreasuryPhysicalCashIncome(
  movement: Pick<TreasuryMovement, "movementType" | "metadata">
): boolean {
  if (movement.movementType !== TREASURY_MOVEMENT_TYPES.INCOME) return false
  return isExplicitEfectivoPaymentMethod(movement)
}

/** Only expenses with medio de pago efectivo reduce physical cash. */
export function isTreasuryPhysicalCashExpense(
  movement: Pick<TreasuryMovement, "movementType" | "metadata">
): boolean {
  if (movement.movementType !== TREASURY_MOVEMENT_TYPES.EXPENSE) return false
  return isExplicitEfectivoPaymentMethod(movement)
}

function isCashMovementInWindow(
  dayKey: string,
  reference: Date,
  opening?: Pick<TreasuryCashOpening, "asOfDate"> | null
): boolean {
  if (hasTreasuryCashOpening(opening)) {
    const asOf = opening!.asOfDate.trim()
    const todayKey = toLocalDayKey(reference)
    return dayKey >= asOf && dayKey <= todayKey
  }

  return isTreasuryDayKeyInRange(dayKey, "month", reference)
}

/**
 * Physical cash in the box.
 * Without an opening/base: month window (Tesorería 3.2).
 * With treasury_cash_settings: opening_balance + physical movements from as_of_date.
 * Only explicit efectivo incomes/expenses; unclassified manuals stay out.
 * Withdrawals always reduce cash. Opening is not an income movement.
 */
export function buildTreasuryCashInBoxMonth(
  movements: ReadonlyArray<CashMovementSource>,
  reference = new Date(),
  opening?: Pick<TreasuryCashOpening, "openingBalance" | "asOfDate"> | null
): number {
  let cash = hasTreasuryCashOpening(opening) ? opening!.openingBalance : 0

  for (const movement of movements) {
    if (movement.status !== TREASURY_STATUSES.CONFIRMED) continue
    if (!isCashMovementInWindow(toDayKey(movement.movementDate), reference, opening)) {
      continue
    }

    const amount = movement.amount
    if (!Number.isFinite(amount) || amount <= 0) continue

    if (movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME) {
      if (isTreasuryPhysicalCashIncome(movement)) cash += amount
      continue
    }

    if (movement.movementType === TREASURY_MOVEMENT_TYPES.WITHDRAWAL) {
      cash -= amount
      continue
    }

    if (
      movement.movementType === TREASURY_MOVEMENT_TYPES.EXPENSE &&
      isTreasuryPhysicalCashExpense(movement)
    ) {
      cash -= amount
    }
  }

  return cash
}
