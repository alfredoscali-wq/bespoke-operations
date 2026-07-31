/**
 * Filters internal/system labels so the Jornada UX stays in business language.
 */

/** Action codes, dotted namespaces, or bare UUIDs — not for end-user copy. */
export function isTechnicalActivityLabel(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  ) {
    return true
  }
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(trimmed)) return true
  if (/^[a-z][a-z0-9]*(?:\.[a-z0-9_]+)+$/i.test(trimmed)) return true
  return false
}

export function asBusinessCopy(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  if (isTechnicalActivityLabel(value)) return null
  return value.trim()
}
