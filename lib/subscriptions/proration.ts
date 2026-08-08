/**
 * Cobro inicial proporcional al día de activación dentro del mes calendario local.
 * Incluye el día de activación: días restantes = daysInMonth - day + 1.
 *
 * Ejemplo: abono $20.000, alta 10/08 (31 días) → floor(20000 * 22 / 31) = $14.193
 */
export function calculateProratedAmount(
  monthlyPrice: number,
  activationDate: string | Date
): number {
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    return 0
  }

  const date =
    typeof activationDate === "string"
      ? parseLocalDateOnly(activationDate)
      : activationDate

  if (!date || Number.isNaN(date.getTime())) {
    return 0
  }

  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  if (daysInMonth <= 0 || day < 1 || day > daysInMonth) {
    return 0
  }

  const daysRemaining = daysInMonth - day + 1
  return Math.floor((monthlyPrice * daysRemaining) / daysInMonth)
}

function parseLocalDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function formatSubscriptionMoney(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount)
}
