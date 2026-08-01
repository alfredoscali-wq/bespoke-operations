/**
 * Executive breadcrumb trail for Análisis screens.
 */

import { analysisHref } from "@/lib/analysis/smart-navigation/params"
import { ANALYSIS_NAV_PATHS } from "@/lib/analysis/smart-navigation/hrefs"
import type {
  AnalysisBreadcrumbCrumb,
  AnalysisNavContext,
  AnalysisNavStepId,
} from "@/lib/analysis/smart-navigation/types"

const STEP_LABELS: Record<AnalysisNavStepId, string> = {
  "executive-center": "Centro Ejecutivo",
  "situation-room": "Sala de Situación",
  jornada: "Actividad de la Jornada",
  cuadrillas: "Cuadrillas",
  reportes: "Reportes Operativos",
  planning: "Planning",
  workforce: "Workforce Monitor",
  "daily-brief": "Resumen Ejecutivo Diario",
}

function stepHref(
  step: AnalysisNavStepId,
  context: AnalysisNavContext,
  trailPrefix: AnalysisNavStepId[]
): string {
  const pathname = ANALYSIS_NAV_PATHS[step]
  return analysisHref(pathname, {
    ...context,
    trail: trailPrefix,
  })
}

/**
 * Builds breadcrumb: Análisis > …trail… > current (+ optional entity leaf).
 */
export function buildAnalysisBreadcrumb(input: {
  currentStep: AnalysisNavStepId
  context: AnalysisNavContext
  leafLabel?: string | null
  leafHref?: string | null
}): AnalysisBreadcrumbCrumb[] {
  const crumbs: AnalysisBreadcrumbCrumb[] = [
    {
      id: "analysis-root",
      label: "Análisis",
      href: stepHref("executive-center", input.context, []),
    },
  ]

  const trail = (input.context.trail ?? []).filter(
    (step) => step !== input.currentStep
  )

  for (let index = 0; index < trail.length; index += 1) {
    const step = trail[index]
    crumbs.push({
      id: `trail-${step}-${index}`,
      label: STEP_LABELS[step],
      href: stepHref(step, input.context, trail.slice(0, index + 1)),
    })
  }

  crumbs.push({
    id: `current-${input.currentStep}`,
    label: STEP_LABELS[input.currentStep],
    href: null,
  })

  const leaf =
    input.leafLabel?.trim() ||
    input.context.crewName?.trim() ||
    input.context.employeeName?.trim() ||
    null

  if (leaf) {
    crumbs.push({
      id: "leaf",
      label: leaf,
      href: input.leafHref ?? null,
    })
  }

  return crumbs
}

export function analysisStepLabel(step: AnalysisNavStepId): string {
  return STEP_LABELS[step]
}
