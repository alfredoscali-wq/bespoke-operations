/**
 * Facade config — delegates to official Feature Flags (Sprint 13).
 */

import {
  getIndicatorEngineFeatureFlags,
  resolveVisibleEngineMode,
  type IndicatorEngineMode,
} from "@/lib/indicator-engine/feature-flags"

export const INDICATOR_FACADE_BACKENDS = ["v1", "v2", "dual"] as const

export type IndicatorFacadeBackend = IndicatorEngineMode

export type IndicatorFacadeFeatureFlags = {
  readonly enableShadow?: boolean
  readonly enableComparator?: boolean
  readonly enableTelemetry?: boolean
}

export type IndicatorFacadeConfig = {
  readonly backend: IndicatorFacadeBackend
  readonly features?: IndicatorFacadeFeatureFlags
}

/**
 * Live facade config from Feature Flags (call each time — not a frozen snapshot).
 */
export function getDefaultIndicatorFacadeConfig(): IndicatorFacadeConfig {
  const flags = getIndicatorEngineFeatureFlags()
  return {
    backend: flags.engineMode,
    features: {
      enableShadow: flags.shadowEnabled,
      enableComparator: flags.comparatorEnabled,
      enableTelemetry: flags.telemetryEnabled,
    },
  }
}

/**
 * Static default shape for imports / docs.
 * Prefer `getDefaultIndicatorFacadeConfig()` for live flag values.
 */
export const DEFAULT_INDICATOR_FACADE_CONFIG: IndicatorFacadeConfig = {
  backend: "dual",
  features: {
    enableShadow: true,
    enableComparator: true,
    enableTelemetry: process.env.NODE_ENV !== "production",
  },
}

/**
 * Visible backend for UI — V1 for v1/dual; V2 when engineMode=v2 (Comparator gates brief).
 */
export function resolveIndicatorFacadeBackend(
  config?: IndicatorFacadeConfig
): "v1" | "v2" {
  void config
  return resolveVisibleEngineMode()
}
