import type { BusinessIndicator } from "@/lib/indicator-engine/contracts/business-indicator"
import type { IndicatorAnalysisUnit } from "@/lib/indicator-engine/types/analysis-unit"
import {
  BUSINESS_INDICATOR_CATEGORIES,
  BUSINESS_INDICATOR_ORIGINS,
  BUSINESS_INDICATOR_OWNERS,
  BUSINESS_INDICATOR_STATUSES,
} from "@/lib/indicator-engine/types/indicator-meta"
import type { IndicatorMeasureUnit } from "@/lib/indicator-engine/types/analysis-unit"

const VALID_CATEGORIES = new Set<string>(BUSINESS_INDICATOR_CATEGORIES)
const VALID_STATUSES = new Set<string>(BUSINESS_INDICATOR_STATUSES)
const VALID_OWNERS = new Set<string>(BUSINESS_INDICATOR_OWNERS)
const VALID_ORIGINS = new Set<string>(BUSINESS_INDICATOR_ORIGINS)
const VALID_SCOPES = new Set<string>([
  "company",
  "employee",
  "crew",
  "project",
  "customer",
])
const VALID_UNITS = new Set<string>([
  "count",
  "milliseconds",
  "timestamp_iso",
] satisfies IndicatorMeasureUnit[])

/**
 * Pure validation of registry definitions.
 * Callers decide whether to throw (development) or ignore (production).
 */
export function validateIndicatorRegistryDefinitions(
  definitions: readonly BusinessIndicator[]
): string[] {
  const errors: string[] = []
  const seenIds = new Set<string>()
  const seenIdVersions = new Set<string>()

  for (const indicator of definitions) {
    const { id, version } = indicator

    if (!id.trim()) {
      errors.push("Indicator with empty id.")
      continue
    }

    if (seenIds.has(id)) {
      errors.push(`Duplicate indicator id: "${id}".`)
    } else {
      seenIds.add(id)
    }

    const idVersionKey = `${id}@${version}`
    if (seenIdVersions.has(idVersionKey)) {
      errors.push(`Repeated version for indicator "${id}": "${version}".`)
    } else {
      seenIdVersions.add(idVersionKey)
    }

    if (!version.trim()) {
      errors.push(`Indicator "${id}" has an empty version.`)
    }

    if (!VALID_CATEGORIES.has(indicator.category)) {
      errors.push(
        `Indicator "${id}" has invalid category: "${indicator.category}".`
      )
    }

    if (!VALID_UNITS.has(indicator.unit)) {
      errors.push(`Indicator "${id}" has invalid unit: "${indicator.unit}".`)
    }

    if (!VALID_STATUSES.has(indicator.status)) {
      errors.push(
        `Indicator "${id}" has invalid status: "${indicator.status}".`
      )
    }

    if (!VALID_OWNERS.has(indicator.owner)) {
      errors.push(`Indicator "${id}" has invalid owner: "${indicator.owner}".`)
    }

    if (!VALID_ORIGINS.has(indicator.origin)) {
      errors.push(
        `Indicator "${id}" has invalid origin: "${indicator.origin}".`
      )
    }

    if (!indicator.scope.length) {
      errors.push(`Indicator "${id}" has empty scope.`)
    }

    for (const scope of indicator.scope) {
      if (!VALID_SCOPES.has(scope)) {
        errors.push(`Indicator "${id}" has invalid scope: "${scope}".`)
      }
    }
  }

  return errors
}

export function assertIndicatorRegistryValidInDevelopment(
  definitions: readonly BusinessIndicator[]
): void {
  if (process.env.NODE_ENV === "production") return

  const errors = validateIndicatorRegistryDefinitions(definitions)
  if (errors.length === 0) return

  throw new Error(
    [
      "Indicator Registry validation failed (development only):",
      ...errors.map((error) => `  - ${error}`),
    ].join("\n")
  )
}

export function isValidAnalysisUnit(
  value: string
): value is IndicatorAnalysisUnit {
  return VALID_SCOPES.has(value)
}
