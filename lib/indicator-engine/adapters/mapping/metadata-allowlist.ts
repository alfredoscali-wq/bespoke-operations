/**
 * Metadata keys allowed into Activity Input (indicator-relevant only).
 * All other AE metadata keys are dropped by the adapter.
 */
export const ACTIVITY_INPUT_METADATA_ALLOWLIST = [
  /** Retention / next-step business signals (legacy CS). */
  "new_next_step",
  "previous_next_step",
  "next_step",
] as const

const ALLOWED = new Set<string>(ACTIVITY_INPUT_METADATA_ALLOWLIST)

/**
 * Project opaque metadata into a string-only business bag.
 */
export function projectBusinessMetadata(
  metadata: unknown
): Readonly<Record<string, string>> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {}
  }

  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(
    metadata as Record<string, unknown>
  )) {
    if (!ALLOWED.has(key)) continue
    if (value == null) continue
    if (typeof value === "string") {
      out[key] = value
      continue
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value)
    }
  }
  return out
}
