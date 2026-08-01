import type { BusinessIndicator } from "@/lib/indicator-engine/contracts/business-indicator"
import type { BusinessIndicatorCategory } from "@/lib/indicator-engine/types/indicator-meta"
import type { IndicatorAnalysisUnit } from "@/lib/indicator-engine/types/analysis-unit"
import type { BusinessIndicatorId } from "@/lib/indicator-engine/types"
import { assertIndicatorRegistryValidInDevelopment } from "@/lib/indicator-engine/registry/validate-registry"

/**
 * Central registry port for all business indicators.
 * Product modules must not define indicators outside this registry.
 */
export type IndicatorRegistry = {
  readonly catalogVersion: string
  get(id: BusinessIndicatorId): BusinessIndicator | undefined
  has(id: BusinessIndicatorId): boolean
  list(): readonly BusinessIndicator[]
  listByScope(unit: IndicatorAnalysisUnit): readonly BusinessIndicator[]
  listByCategory(
    category: BusinessIndicatorCategory
  ): readonly BusinessIndicator[]
  /** @deprecated Prefer listByScope — kept for Sprint 1 call-site compatibility. */
  listByAnalysisUnit(
    unit: IndicatorAnalysisUnit
  ): readonly BusinessIndicator[]
}

export type IndicatorRegistryBuilder = {
  register(indicator: BusinessIndicator): IndicatorRegistryBuilder
  build(): IndicatorRegistry
}

function createRegistryInstance(
  catalogVersion: string,
  definitions: readonly BusinessIndicator[]
): IndicatorRegistry {
  const map = new Map(
    definitions.map((indicator) => [indicator.id, indicator] as const)
  )
  const frozen = Object.freeze([...definitions]) as readonly BusinessIndicator[]

  const listByScope = (unit: IndicatorAnalysisUnit) =>
    frozen.filter((item) => item.scope.includes(unit))

  return {
    catalogVersion,
    get(id) {
      return map.get(id)
    },
    has(id) {
      return map.has(id)
    },
    list() {
      return frozen
    },
    listByScope,
    listByCategory(category) {
      return frozen.filter((item) => item.category === category)
    },
    listByAnalysisUnit: listByScope,
  }
}

/**
 * Factory for a mutable registry (tests / alternate seeds).
 * Validates on `build()` in development only.
 */
export function createIndicatorRegistryBuilder(
  catalogVersion: string
): IndicatorRegistryBuilder {
  const ordered: BusinessIndicator[] = []
  const byId = new Map<BusinessIndicatorId, BusinessIndicator>()

  const builder: IndicatorRegistryBuilder = {
    register(indicator) {
      if (byId.has(indicator.id) && process.env.NODE_ENV !== "production") {
        throw new Error(
          `Indicator Registry validation failed (development only):\n  - Duplicate indicator id: "${indicator.id}".`
        )
      }
      byId.set(indicator.id, indicator)
      ordered.push(indicator)
      return builder
    },
    build() {
      assertIndicatorRegistryValidInDevelopment(ordered)
      return createRegistryInstance(catalogVersion, ordered)
    },
  }

  return builder
}

/**
 * Build an immutable registry from a definition list.
 * Development: throws on duplicate ids, invalid category/scope, repeated versions.
 * Production: never throws from validation.
 */
export function buildIndicatorRegistry(
  catalogVersion: string,
  definitions: readonly BusinessIndicator[]
): IndicatorRegistry {
  assertIndicatorRegistryValidInDevelopment(definitions)
  return createRegistryInstance(catalogVersion, definitions)
}
