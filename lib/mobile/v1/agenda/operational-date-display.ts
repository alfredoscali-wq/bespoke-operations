/**
 * Pure helpers for multi-day OT date display on mobile agenda.
 * Format: "10 Ago 2026" or "08 Ago 2026 → 10 Ago 2026"
 */

const MONTH_LABELS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const

function parseDateOnlyParts(
  value: string
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

export function formatOperationalDateLabel(dateOnly: string): string {
  const parts = parseDateOnlyParts(dateOnly)
  if (!parts) return dateOnly.trim() || "—"
  const month = MONTH_LABELS_ES[parts.month - 1]
  const day = String(parts.day).padStart(2, "0")
  return `${day} ${month} ${parts.year}`
}

/**
 * Single-day → one label. Multi-day → "start → end".
 * Falls back to dueDate when startDate is empty.
 */
export function formatOperationalDateRangeLabel(
  startDate: string | null | undefined,
  dueDate: string
): string {
  const end = dueDate.trim()
  const start = (startDate?.trim() || end).trim()
  if (!end) return "—"
  if (start === end) {
    return formatOperationalDateLabel(end)
  }
  return `${formatOperationalDateLabel(start)} → ${formatOperationalDateLabel(end)}`
}

export function resolveObraAgendaLegend(
  projectName: string | null | undefined
): string {
  const name = projectName?.trim()
  if (name) return `Obra: ${name}`
  return "OT de Obra"
}
