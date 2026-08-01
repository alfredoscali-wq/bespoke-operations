import { indicatorRegistry } from "@/lib/indicator-engine/registry"

export {
  BUSINESS_INDICATOR_IDS,
  INDICATOR_ENGINE_DEFINITIONS,
  type RegisteredBusinessIndicatorId,
} from "@/lib/indicator-engine/catalog/definitions"

/**
 * Frozen list of registered indicators (same as `indicatorRegistry.list()`).
 */
export const INDICATOR_ENGINE_CATALOG = indicatorRegistry.list()

export function getIndicatorEngineCatalogVersion(): string {
  return indicatorRegistry.catalogVersion
}

export function getBusinessIndicator(id: string) {
  return indicatorRegistry.get(id)
}

export function listBusinessIndicators() {
  return indicatorRegistry.list()
}
