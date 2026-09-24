import { parseDateOnlyForDisplay } from "@/lib/dates/date-only"

const REPORT_TIME_ZONE = "America/Argentina/Buenos_Aires"

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatProjectWorkReportDate(
  value?: string | null
): string | null {
  if (!value?.trim()) {
    return null
  }

  const parsed = parseDateOnlyForDisplay(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`
}

export function formatProjectWorkReportDateTime(
  value?: string | null
): string | null {
  if (!value?.trim()) {
    return null
  }

  const parsed = parseDateOnlyForDisplay(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return `${formatProjectWorkReportDate(value)} ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`
}

export function formatProjectWorkReportGeneratedAt(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return formatProjectWorkReportDateTime(iso) ?? iso
  }

  const formatted = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: REPORT_TIME_ZONE,
  }).format(parsed)

  return formatted.replace(",", "")
}

export function formatProjectWorkReportPeriod(
  startDate?: string | null,
  endDate?: string | null
): string | null {
  const start = formatProjectWorkReportDate(startDate)
  const end = formatProjectWorkReportDate(endDate)

  if (start && end) {
    return `${start} — ${end}`
  }

  return start ?? end
}

export function formatProjectWorkReportIncludedCount(count: number): string {
  return `${count} OT`
}

export function hexToRgb(
  value?: string | null
): { r: number; g: number; b: number } | null {
  if (!value || !/^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    return null
  }

  const hex = value.trim()
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}
