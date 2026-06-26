import type { WorkOrderTechnology } from "@/lib/tasks/work-order"
import { normalizeComparisonKey } from "@/lib/customers/normalization/text"

/** Tipos legacy que deben ignorarse (no son acceso internet). */
const IGNORED_LEGACY_TECHNOLOGIES = new Set([
  "tv plan",
  "tv",
  "television",
  "pack tv",
])

const TECHNOLOGY_LOOKUP = new Map<string, WorkOrderTechnology>([
  ["fibra", "fiber"],
  ["fibra optica", "fiber"],
  ["fo", "fiber"],
  ["ftth", "fiber"],
  ["pppoe", "fiber"],
  ["wireless", "wireless"],
  ["radio", "wireless"],
  ["aire", "wireless"],
  ["wi-fi", "wireless"],
  ["wifi", "wireless"],
])

export type ResolvedCommercialTechnology = {
  raw: string
  mapped: WorkOrderTechnology | ""
  ignored: boolean
  inconsistent: boolean
}

/**
 * Mapea tecnología comercial legacy → Bespoke.
 * Solo Fibra/Wireless. TV y similares se ignoran.
 */
export function resolveCommercialTechnology(
  value: unknown
): ResolvedCommercialTechnology {
  const raw = String(value ?? "").trim()
  if (!raw) {
    return { raw: "", mapped: "", ignored: false, inconsistent: false }
  }

  const key = normalizeComparisonKey(raw)

  if (IGNORED_LEGACY_TECHNOLOGIES.has(key) || key.includes("tv")) {
    return { raw, mapped: "", ignored: true, inconsistent: false }
  }

  const direct = TECHNOLOGY_LOOKUP.get(key)
  if (direct) {
    return { raw, mapped: direct, ignored: false, inconsistent: false }
  }

  if (key.includes("fibra") || key.includes("ftth") || key.includes("pppoe")) {
    return { raw, mapped: "fiber", ignored: false, inconsistent: false }
  }

  if (key.includes("wireless") || key.includes("radio")) {
    return { raw, mapped: "wireless", ignored: false, inconsistent: false }
  }

  return { raw, mapped: "", ignored: false, inconsistent: true }
}

/** Compatibilidad con importador Excel existente. */
export function resolveImportTechnology(
  value: unknown
): WorkOrderTechnology | "" {
  return resolveCommercialTechnology(value).mapped
}
