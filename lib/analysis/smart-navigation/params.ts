/**
 * Parse / serialize Análisis navigation context from URLSearchParams.
 */

import type {
  AnalysisNavContext,
  AnalysisNavStepId,
} from "@/lib/analysis/smart-navigation/types"

const STEP_IDS = new Set<AnalysisNavStepId>([
  "executive-center",
  "situation-room",
  "jornada",
  "cuadrillas",
  "reportes",
  "planning",
  "workforce",
  "daily-brief",
])

function optional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function normalizeStepId(part: string): AnalysisNavStepId | null {
  if (part === "crew-production" || part === "timeline-operativo") {
    return "cuadrillas"
  }
  if (STEP_IDS.has(part as AnalysisNavStepId)) {
    return part as AnalysisNavStepId
  }
  return null
}

function parseTrail(raw: string | null | undefined): AnalysisNavStepId[] {
  if (!raw?.trim()) return []
  return raw
    .split("|")
    .map((part) => part.trim())
    .map(normalizeStepId)
    .filter((part): part is AnalysisNavStepId => part != null)
}

export function parseAnalysisNavContext(
  searchParams: URLSearchParams | { get(name: string): string | null }
): AnalysisNavContext {
  return {
    date: optional(searchParams.get("date")),
    dateFrom: optional(searchParams.get("dateFrom")),
    dateTo: optional(searchParams.get("dateTo")),
    employeeId: optional(searchParams.get("employeeId")),
    employeeName: optional(searchParams.get("employeeName")),
    crewId: optional(searchParams.get("crewId")),
    crewName: optional(searchParams.get("crewName")),
    projectId: optional(searchParams.get("projectId")),
    projectName: optional(searchParams.get("projectName")),
    customerId: optional(searchParams.get("customerId")),
    customerName: optional(searchParams.get("customerName")),
    period: optional(searchParams.get("period")),
    startDate: optional(searchParams.get("startDate")),
    endDate: optional(searchParams.get("endDate")),
    opsArea: optional(searchParams.get("opsArea")),
    taskId: optional(searchParams.get("taskId")),
    trail: parseTrail(searchParams.get("trail")),
  }
}

export function mergeAnalysisNavContext(
  base: AnalysisNavContext,
  patch: AnalysisNavContext
): AnalysisNavContext {
  const next: AnalysisNavContext = { ...base }

  for (const [key, value] of Object.entries(patch) as Array<
    [keyof AnalysisNavContext, AnalysisNavContext[keyof AnalysisNavContext]]
  >) {
    if (value === undefined) continue
    if (value === null || value === "") {
      delete next[key]
      continue
    }
    ;(next as Record<string, unknown>)[key] = value
  }

  return next
}

/**
 * Append current step to trail when navigating forward.
 */
export function pushAnalysisTrail(
  trail: AnalysisNavStepId[] | undefined,
  step: AnalysisNavStepId
): AnalysisNavStepId[] {
  const current = trail ?? []
  if (current[current.length - 1] === step) {
    return current
  }
  return [...current.filter((id) => id !== step), step]
}

export function buildAnalysisSearchParams(
  context: AnalysisNavContext
): URLSearchParams {
  const params = new URLSearchParams()
  const entries: Array<[string, string | undefined]> = [
    ["date", context.date],
    ["dateFrom", context.dateFrom],
    ["dateTo", context.dateTo],
    ["employeeId", context.employeeId],
    ["employeeName", context.employeeName],
    ["crewId", context.crewId],
    ["crewName", context.crewName],
    ["projectId", context.projectId],
    ["projectName", context.projectName],
    ["customerId", context.customerId],
    ["customerName", context.customerName],
    ["period", context.period],
    ["startDate", context.startDate],
    ["endDate", context.endDate],
    ["opsArea", context.opsArea],
    ["taskId", context.taskId],
    [
      "trail",
      context.trail && context.trail.length > 0
        ? context.trail.join("|")
        : undefined,
    ],
  ]

  for (const [key, value] of entries) {
    if (value?.trim()) params.set(key, value.trim())
  }

  return params
}

export function analysisHref(
  pathname: string,
  context: AnalysisNavContext
): string {
  const params = buildAnalysisSearchParams(context)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
