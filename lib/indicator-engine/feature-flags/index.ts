/**
 * Official Feature Flags for Indicator Engine migration control (Sprint 13).
 */

export {
  clearIndicatorEngineFeatureFlagsOverride,
  DEFAULT_INDICATOR_ENGINE_FEATURE_FLAGS,
  getIndicatorEngineFeatureFlags,
  INDICATOR_ENGINE_MODES,
  indicatorEngineFeatureFlags,
  isComparatorEnabled,
  isShadowPipelineEnabled,
  isTelemetryEnabled,
  resolveVisibleEngineMode,
  setIndicatorEngineFeatureFlagsOverride,
  shouldRunDualReadSidePath,
  type IndicatorEngineFeatureFlags,
  type IndicatorEngineFeatureFlagsPartial,
  type IndicatorEngineMode,
} from "@/lib/indicator-engine/feature-flags/indicator-engine-feature-flags"
