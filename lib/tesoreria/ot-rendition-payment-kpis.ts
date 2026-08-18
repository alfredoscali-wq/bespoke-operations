/**
 * Tesorería 3.1 — composition of confirmed period incomes by payment method.
 * OT cobranzas use payment_method_received. Manual incomes without a method → Otros.
 * Always returns all buckets, including $0.
 */

import { TREASURY_MOVEMENT_TYPES, TREASURY_STATUSES } from "@/lib/tesoreria/categories"
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
