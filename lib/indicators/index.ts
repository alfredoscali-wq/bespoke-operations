/**
 * Indicator Engine
 *
 * Activity Engine → Indicator Engine → Production Reports
 *
 * Reports ask "what did this entity produce?" via indicators.
 * They must not embed event.module business rules.
 */

export {
  EMPLOYEE_DAILY_INDICATOR_IDS,
  EXECUTIVE_BRIEF_INDICATOR_IDS,
  getIndicatorDefinition,
  INDICATOR_CATALOG,
  INDICATOR_IDS,
  listIndicatorDefinitions,
  WORKFORCE_BUCKET_INDICATOR_IDS,
  type IndicatorId,
} from "@/lib/indicators/catalog"
export {
  computeCompanyIndicatorSnapshot,
  computeIndicatorSnapshot,
  computeIndicatorSnapshotsByEmployee,
  emptyIndicatorSnapshot,
  indicatorCount,
  indicatorTimestamp,
} from "@/lib/indicators/compute"
export {
  ACTIVITY_MODULE_ALIASES,
  canonicalizeActivityModule,
  expandActivityModuleFilter,
} from "@/lib/indicators/module-aliases"
export type {
  ComputeIndicatorsOptions,
  IndicatorAnalysisUnit,
  IndicatorCalculation,
  IndicatorDefinition,
  IndicatorMeasureUnit,
  IndicatorSnapshot,
  IndicatorSourceEvent,
  IndicatorValue,
} from "@/lib/indicators/types"
