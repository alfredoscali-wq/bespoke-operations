import {
  INDICATOR_ENGINE_DEFINITIONS,
} from "@/lib/indicator-engine/catalog/definitions"
import { buildIndicatorRegistry } from "@/lib/indicator-engine/registry/indicator-registry"

/** Registry release for Platform 2.0 Sprint 2. */
export const INDICATOR_ENGINE_CATALOG_VERSION = "2.0.0-sprint2"

/**
 * Official Indicator Engine 2.0 registry — sole source of KPI definitions
 * for the new engine. Isolated from `@/lib/indicators` runtime.
 */
export const indicatorRegistry = buildIndicatorRegistry(
  INDICATOR_ENGINE_CATALOG_VERSION,
  INDICATOR_ENGINE_DEFINITIONS
)
