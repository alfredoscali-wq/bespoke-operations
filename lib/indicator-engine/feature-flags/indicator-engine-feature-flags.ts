/**
 * Indicator Engine Feature Flags (Sprint 13).
 *
 * Local app configuration only — no Supabase, no DB persistence.
 * Override via env vars or in-memory override (tests / future admin).
 */

export const INDICATOR_ENGINE_MODES = ["v1", "dual", "v2"] as const

export type IndicatorEngineMode = (typeof INDICATOR_ENGINE_MODES)[number]

export type IndicatorEngineFeatureFlags = {
  /** Which engine path is active for migration control. */
  readonly engineMode: IndicatorEngineMode
  /** When true, Shadow Pipeline may execute (never renders). */
  readonly shadowEnabled: boolean
  /** When true, Comparator may execute (never persists / never shows in UI). */
  readonly comparatorEnabled: boolean
  /** When true, Performance Telemetry records in-memory reports. */
  readonly telemetryEnabled: boolean
}

export type IndicatorEngineFeatureFlagsPartial =
  Partial<IndicatorEngineFeatureFlags>

function parseBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (value == null || value.trim() === "") return fallback
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return fallback
}

function parseMode(
  value: string | undefined,
  fallback: IndicatorEngineMode
): IndicatorEngineMode {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "v1" || normalized === "dual" || normalized === "v2") {
    return normalized
  }
  return fallback
}

function defaultTelemetryEnabled(): boolean {
  return process.env.NODE_ENV !== "production"
}

/**
 * Default flags for Platform 2.0 Sprint 13.
 * Visible UI remains V1; dual/shadow/comparator run beside it.
 */
export const DEFAULT_INDICATOR_ENGINE_FEATURE_FLAGS: IndicatorEngineFeatureFlags =
  {
    engineMode: "dual",
    shadowEnabled: true,
    comparatorEnabled: true,
    telemetryEnabled: defaultTelemetryEnabled(),
  }

let memoryOverride: IndicatorEngineFeatureFlagsPartial | null = null

/**
 * In-memory override for tests / local control without code changes.
 * Pass `null` to clear.
 */
export function setIndicatorEngineFeatureFlagsOverride(
  override: IndicatorEngineFeatureFlagsPartial | null
): void {
  memoryOverride = override
}

export function clearIndicatorEngineFeatureFlagsOverride(): void {
  memoryOverride = null
}

function readEnvFlags(): IndicatorEngineFeatureFlagsPartial {
  return {
    engineMode: parseMode(
      process.env.INDICATOR_ENGINE_MODE,
      DEFAULT_INDICATOR_ENGINE_FEATURE_FLAGS.engineMode
    ),
    shadowEnabled: parseBoolean(
      process.env.INDICATOR_ENGINE_SHADOW,
      DEFAULT_INDICATOR_ENGINE_FEATURE_FLAGS.shadowEnabled
    ),
    comparatorEnabled: parseBoolean(
      process.env.INDICATOR_ENGINE_COMPARATOR,
      DEFAULT_INDICATOR_ENGINE_FEATURE_FLAGS.comparatorEnabled
    ),
    telemetryEnabled: parseBoolean(
      process.env.INDICATOR_ENGINE_TELEMETRY,
      defaultTelemetryEnabled()
    ),
  }
}

/**
 * Resolves the effective Feature Flags (override → env → defaults).
 */
export function getIndicatorEngineFeatureFlags(): IndicatorEngineFeatureFlags {
  const fromEnv = readEnvFlags()
  return {
    engineMode:
      memoryOverride?.engineMode ??
      fromEnv.engineMode ??
      DEFAULT_INDICATOR_ENGINE_FEATURE_FLAGS.engineMode,
    shadowEnabled:
      memoryOverride?.shadowEnabled ??
      fromEnv.shadowEnabled ??
      DEFAULT_INDICATOR_ENGINE_FEATURE_FLAGS.shadowEnabled,
    comparatorEnabled:
      memoryOverride?.comparatorEnabled ??
      fromEnv.comparatorEnabled ??
      DEFAULT_INDICATOR_ENGINE_FEATURE_FLAGS.comparatorEnabled,
    telemetryEnabled:
      memoryOverride?.telemetryEnabled ??
      fromEnv.telemetryEnabled ??
      defaultTelemetryEnabled(),
  }
}

/**
 * Visible UI mode from Feature Flags (Sprint 20).
 * - v1 / dual → official UI path is V1
 * - v2 → Snapshot path is eligible (Comparator still gates the actual brief)
 */
export function resolveVisibleEngineMode(
  flags: IndicatorEngineFeatureFlags = getIndicatorEngineFeatureFlags()
): "v1" | "v2" {
  return flags.engineMode === "v2" ? "v2" : "v1"
}

/** Dual / V2 migration modes run a parallel side path (never shown). */
export function shouldRunDualReadSidePath(
  flags: IndicatorEngineFeatureFlags = getIndicatorEngineFeatureFlags()
): boolean {
  return flags.engineMode === "dual" || flags.engineMode === "v2"
}

export function isShadowPipelineEnabled(
  flags: IndicatorEngineFeatureFlags = getIndicatorEngineFeatureFlags()
): boolean {
  if (flags.engineMode === "v1") return false
  return flags.shadowEnabled
}

export function isComparatorEnabled(
  flags: IndicatorEngineFeatureFlags = getIndicatorEngineFeatureFlags()
): boolean {
  if (flags.engineMode === "v1") return false
  return flags.comparatorEnabled
}

export function isTelemetryEnabled(
  flags: IndicatorEngineFeatureFlags = getIndicatorEngineFeatureFlags()
): boolean {
  return flags.telemetryEnabled
}

export const indicatorEngineFeatureFlags = {
  get: getIndicatorEngineFeatureFlags,
  setOverride: setIndicatorEngineFeatureFlagsOverride,
  clearOverride: clearIndicatorEngineFeatureFlagsOverride,
  resolveVisibleEngineMode,
  shouldRunDualReadSidePath,
  isShadowPipelineEnabled,
  isComparatorEnabled,
  isTelemetryEnabled,
} as const
