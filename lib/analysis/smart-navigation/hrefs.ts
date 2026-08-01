/**
 * Destination href builders for Análisis smart navigation.
 */

import {
  analysisHref,
  mergeAnalysisNavContext,
  pushAnalysisTrail,
} from "@/lib/analysis/smart-navigation/params"
import type {
  AnalysisNavContext,
  AnalysisNavStepId,
} from "@/lib/analysis/smart-navigation/types"

const PATHS = {
  "executive-center": "/activity/executive-center",
  "situation-room": "/activity",
  jornada: "/activity/jornada",
  cuadrillas: "/activity/cuadrillas",
  reportes: "/reportes/operativos",
  planning: "/operations/planificacion",
  workforce: "/activity/workforce-monitor",
  "daily-brief": "/activity/daily-brief",
} as const

function withTrail(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null,
  toStep: AnalysisNavStepId
): AnalysisNavContext {
  const trail = fromStep
    ? pushAnalysisTrail(context.trail, fromStep)
    : (context.trail ?? [])
  return mergeAnalysisNavContext(context, {
    trail: pushAnalysisTrail(trail, toStep),
  })
}

export function hrefExecutiveCenter(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return analysisHref(
    PATHS["executive-center"],
    withTrail(context, fromStep, "executive-center")
  )
}

export function hrefSituationRoom(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return analysisHref(
    PATHS["situation-room"],
    withTrail(context, fromStep, "situation-room")
  )
}

export function hrefJornada(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return analysisHref(PATHS.jornada, withTrail(context, fromStep, "jornada"))
}

/** CUADRILLAS expediente (replaces Producción de Cuadrillas / Timeline Operativo). */
export function hrefCuadrillas(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return analysisHref(
    PATHS.cuadrillas,
    withTrail(context, fromStep, "cuadrillas")
  )
}

/** @deprecated Use hrefCuadrillas */
export function hrefCrewProduction(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return hrefCuadrillas(context, fromStep)
}

/** @deprecated Timeline is embedded in CUADRILLAS — same destination. */
export function hrefTimelineOperativo(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return hrefCuadrillas(context, fromStep)
}

export function hrefReportesOperativos(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return analysisHref(PATHS.reportes, withTrail(context, fromStep, "reportes"))
}

export function hrefPlanning(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return analysisHref(PATHS.planning, withTrail(context, fromStep, "planning"))
}

export function hrefWorkforce(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return analysisHref(
    PATHS.workforce,
    withTrail(context, fromStep, "workforce")
  )
}

export function hrefDailyBrief(
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId | null = null
): string {
  return analysisHref(
    PATHS["daily-brief"],
    withTrail(context, fromStep, "daily-brief")
  )
}

/**
 * Map a bare module path (from rules) onto a contextual href.
 */
export function contextualizeAnalysisHref(
  bareHref: string,
  context: AnalysisNavContext,
  fromStep: AnalysisNavStepId
): string {
  const path = bareHref.split("?")[0] ?? bareHref

  if (path === "/activity/executive-center") {
    return hrefExecutiveCenter(context, fromStep)
  }
  if (path === "/activity" || path === "/activity/") {
    return hrefSituationRoom(context, fromStep)
  }
  if (path === "/activity/jornada") {
    return hrefJornada(context, fromStep)
  }
  if (
    path === "/activity/cuadrillas" ||
    path === "/activity/crew-production" ||
    path === "/activity/timeline-operativo"
  ) {
    return hrefCuadrillas(context, fromStep)
  }
  if (path.startsWith("/reportes")) {
    return hrefReportesOperativos(context, fromStep)
  }
  if (path.startsWith("/operations/planificacion")) {
    return hrefPlanning(context, fromStep)
  }
  if (path === "/activity/workforce-monitor") {
    return hrefWorkforce(context, fromStep)
  }
  if (path === "/activity/daily-brief") {
    return hrefDailyBrief(context, fromStep)
  }
  if (path === "/atencion-cliente") {
    return analysisHref(path, {
      date: context.date,
      trail: pushAnalysisTrail(context.trail, fromStep),
    })
  }
  if (path.startsWith("/gestion-comercial")) {
    return analysisHref(path, {
      date: context.date,
      trail: pushAnalysisTrail(context.trail, fromStep),
    })
  }

  return analysisHref(path, mergeAnalysisNavContext(context, {}))
}

export const ANALYSIS_NAV_PATHS = PATHS
