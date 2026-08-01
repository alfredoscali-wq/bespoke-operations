/**
 * Análisis Smart Navigation — Sprint 23.
 */

export {
  buildAnalysisBreadcrumb,
  analysisStepLabel,
} from "@/lib/analysis/smart-navigation/breadcrumb"

export {
  hrefForCrewProductionKpi,
  hrefForRelevantActivity,
  hrefForSituationRoomAlert,
  hrefForSituationRoomMetric,
} from "@/lib/analysis/smart-navigation/destinations"

export {
  ANALYSIS_NAV_PATHS,
  contextualizeAnalysisHref,
  hrefCrewProduction,
  hrefCuadrillas,
  hrefDailyBrief,
  hrefExecutiveCenter,
  hrefJornada,
  hrefPlanning,
  hrefReportesOperativos,
  hrefSituationRoom,
  hrefTimelineOperativo,
  hrefWorkforce,
} from "@/lib/analysis/smart-navigation/hrefs"

export {
  analysisHref,
  buildAnalysisSearchParams,
  mergeAnalysisNavContext,
  parseAnalysisNavContext,
  pushAnalysisTrail,
} from "@/lib/analysis/smart-navigation/params"

export type {
  AnalysisBreadcrumbCrumb,
  AnalysisNavContext,
  AnalysisNavStepId,
} from "@/lib/analysis/smart-navigation/types"
