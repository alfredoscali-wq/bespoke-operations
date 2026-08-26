import { roundBillingMoney } from "@/lib/isp/billing-document-integrity"

export const BILLING_MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const

export type BillingPeriod = {
  year: number
  month: number
}

const ARGENTINA_TZ = "America/Argentina/Buenos_Aires"
const DAY_MS = 24 * 60 * 60 * 1000

export function isValidBillingPeriod(period: BillingPeriod): boolean {
  return (
    Number.isInteger(period.year) &&
    Number.isInteger(period.month) &&
    period.year >= 2000 &&
    period.year <= 2100 &&
    period.month >= 1 &&
    period.month <= 12
  )
}

export function currentBillingPeriod(reference = new Date()): BillingPeriod {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(reference)
  const year = Number(parts.find((part) => part.type === "year")?.value)
  const month = Number(parts.find((part) => part.type === "month")?.value)
  return { year, month }
}

export function billingPeriodLabel(period: BillingPeriod): string {
  return `${BILLING_MONTH_NAMES[period.month - 1]} ${period.year}`
}

export function billingPeriodTitle(period: BillingPeriod): string {
  return `Facturación ${billingPeriodLabel(period)}`
}

export function previousBillingPeriod(period: BillingPeriod): BillingPeriod {
  if (period.month === 1) {
    return { year: period.year - 1, month: 12 }
  }
  return { year: period.year, month: period.month - 1 }
}

export function billingPeriodStartIso(period: BillingPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}-01`
}

export function daysInBillingMonth(period: BillingPeriod): number {
  return new Date(Date.UTC(period.year, period.month, 0)).getUTCDate()
}

export function billingPeriodEndIso(period: BillingPeriod): string {
  const days = daysInBillingMonth(period)
  return `${period.year}-${String(period.month).padStart(2, "0")}-${String(days).padStart(2, "0")}`
}

export function parseIsoDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export function toIsoDateOnly(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function inclusiveDayCount(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  if (end < start) return 0
  return Math.round((end - start) / DAY_MS) + 1
}

export type MonthlyProrationInput = {
  monthlyAmount: number
  activationDate: string
  periodStart: string
  periodEnd: string
}

export type MonthlyProrationResult = {
  billableDays: number
  periodDays: number
  amount: number
}

export function calculateMonthlyProration(
  input: MonthlyProrationInput
): MonthlyProrationResult {
  const monthlyAmount = roundBillingMoney(Math.max(0, input.monthlyAmount))
  const periodStart = parseIsoDateOnly(input.periodStart)
  const periodEnd = parseIsoDateOnly(input.periodEnd)
  const activation = parseIsoDateOnly(input.activationDate)

  if (!periodStart || !periodEnd || !activation || periodEnd < periodStart) {
    return { billableDays: 0, periodDays: 0, amount: 0 }
  }

  const periodDays = inclusiveDayCount(periodStart, periodEnd)
  if (activation > periodEnd) {
    return { billableDays: 0, periodDays, amount: 0 }
  }

  const billableStart = activation > periodStart ? activation : periodStart
  const billableDays = inclusiveDayCount(billableStart, periodEnd)
  if (billableDays <= 0) {
    return { billableDays: 0, periodDays, amount: 0 }
  }
  if (billableDays >= periodDays) {
    return { billableDays: periodDays, periodDays, amount: monthlyAmount }
  }

  return {
    billableDays,
    periodDays,
    amount: roundBillingMoney((monthlyAmount * billableDays) / periodDays),
  }
}
