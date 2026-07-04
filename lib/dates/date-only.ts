const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isDateOnly(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value)
}

/**
 * Parses operational calendar dates (YYYY-MM-DD) at local noon so display
 * does not shift when the runtime timezone is behind UTC.
 * Datetime strings (with "T") are parsed normally.
 */
export function parseDateOnlyForDisplay(value: string): Date {
  if (!value) {
    return new Date(Number.NaN)
  }

  if (isDateOnly(value)) {
    return new Date(`${value}T12:00:00`)
  }

  return new Date(value)
}

type FormatDateOnlyOptions = {
  locale?: string
  emptyLabel?: string
}

export function formatDateOnly(
  value?: string | null,
  options: FormatDateOnlyOptions = {}
): string {
  const { locale = "es-MX", emptyLabel = "—" } = options

  if (!value) {
    return emptyLabel
  }

  const parsed = parseDateOnlyForDisplay(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

export function formatDateOnlyDateTime(
  value?: string | null,
  options: FormatDateOnlyOptions = {}
): string {
  const { locale = "es-MX", emptyLabel = "—" } = options

  if (!value) {
    return emptyLabel
  }

  const parsed = parseDateOnlyForDisplay(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}

/** Stable ordering for YYYY-MM-DD strings and mixed date inputs. */
export function compareDateOnly(a: string, b: string): number {
  if (isDateOnly(a) && isDateOnly(b)) {
    return a.localeCompare(b)
  }

  return (
    parseDateOnlyForDisplay(a).getTime() - parseDateOnlyForDisplay(b).getTime()
  )
}

/** Calendar date in the runtime local timezone (YYYY-MM-DD). */
export function toLocalDateOnly(value: Date = new Date()): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
