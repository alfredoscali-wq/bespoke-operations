/**
 * Tesorería 2.2 — secondary KPIs by payment_method_received (cobranza real).
 * Groups debito + credito (+ legacy tarjeta) into Tarjetas.
 * Only returns buckets with amount > 0 for the local calendar day.
 */

import { TREASURY_OT_RENDITION_STATUSES } from "@/lib/tesoreria/ot-rendition-status"
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
  "Basado en el medio realmente cobrado al momento de la rendición."

type RenditionPaymentSource = Pick<
  TreasuryOtRendition,
  "status" | "amount" | "collectionDate" | "paymentMethodReceived"
>

function startOfLocalDay(reference = new Date()): Date {
  const date = new Date(reference)
  date.setHours(0, 0, 0, 0)
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

/** Map received method → KPI bucket. Debito/credito/tarjeta → Tarjetas. */
export function resolveTreasuryPaymentMethodKpiBucket(
  method: string | null | undefined
): TreasuryPaymentMethodKpiKey | null {
  const trimmed = method?.trim() ?? ""
  if (!trimmed) return null

  if (trimmed === "efectivo") return "efectivo"
  if (trimmed === "transferencia") return "transferencia"
  if (trimmed === "mercadopago") return "mercadopago"
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
 * Secondary KPIs for cobranza del día by payment_method_received.
 * Uses collectionDate (same day key as OT income movements).
 * Does not use payment_method_expected.
 */
export function buildOtRenditionPaymentMethodKpis(
  renditions: ReadonlyArray<RenditionPaymentSource>,
  reference = new Date()
): TreasuryPaymentMethodKpi[] {
  const todayKey = toDayKeyFromDate(startOfLocalDay(reference))
  const totals: Record<TreasuryPaymentMethodKpiKey, number> = {
    efectivo: 0,
    transferencia: 0,
    mercadopago: 0,
    tarjetas: 0,
    cheque: 0,
    otro: 0,
  }

  for (const rendition of renditions) {
    if (rendition.status !== TREASURY_OT_RENDITION_STATUSES.RENDERED) continue
    if (toDayKey(rendition.collectionDate) !== todayKey) continue

    const bucket = resolveTreasuryPaymentMethodKpiBucket(
      rendition.paymentMethodReceived
    )
    if (!bucket) continue

    const amount = rendition.amount
    if (!Number.isFinite(amount) || amount <= 0) continue

    totals[bucket] += amount
  }

  return TREASURY_PAYMENT_METHOD_KPI_KEYS.flatMap((key) => {
    const amount = totals[key]
    if (amount <= 0) return []
    return [
      {
        key,
        label: TREASURY_PAYMENT_METHOD_KPI_LABELS[key],
        amount,
      },
    ]
  })
}
