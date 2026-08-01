/**
 * Indicator Facade — sole authorized public entry for indicators (Sprint 10).
 *
 * Future screens must import from this module (or `@/lib/indicator-engine` facade
 * exports), never from `@/lib/indicators` / `@/lib/executive` / Activity Engine.
 *
 * Sprint 10 backend: Indicator Engine 1.x only (identical behaviour).
 */

export {
  DEFAULT_INDICATOR_FACADE_CONFIG,
  getDefaultIndicatorFacadeConfig,
  INDICATOR_FACADE_BACKENDS,
  resolveIndicatorFacadeBackend,
  type IndicatorFacadeBackend,
  type IndicatorFacadeConfig,
  type IndicatorFacadeFeatureFlags,
} from "@/lib/indicator-engine/facade/config"

export {
  createIndicatorFacade,
  indicatorFacade,
  type IndicatorFacade,
} from "@/lib/indicator-engine/facade/indicator-facade"

export {
  clearSituationRoomDualReadState,
  getLastSituationRoomDualReadState,
  loadSituationRoomViaDualRead,
  type SituationRoomDualReadInput,
  type SituationRoomDualReadResult,
} from "@/lib/indicator-engine/facade/situation-room-dual-read"

export {
  canServeSnapshotOfficialBrief,
  resolveOfficialSituationRoomBrief,
  type OfficialSituationRoomBriefResult,
  type OfficialSituationRoomSource,
} from "@/lib/indicator-engine/facade/official-situation-room-brief"

export { projectSnapshotBriefToExecutiveBrief } from "@/lib/indicator-engine/facade/project-snapshot-brief"

export type {
  BuildExecutiveBriefInput,
  ExecutiveBrief,
  ExecutiveBriefScope,
  ExecutiveBriefScopeKind,
  ExecutiveMetric,
  ExecutiveOperationalAlert,
  ExecutiveProductionBlock,
  ExecutiveRelevantActivityItem,
  IndicatorFacadeDigest,
  ComputeIndicatorsOptions,
  IndicatorSnapshot,
  IndicatorSourceEvent,
  IndicatorValue,
} from "@/lib/indicator-engine/facade/types"
