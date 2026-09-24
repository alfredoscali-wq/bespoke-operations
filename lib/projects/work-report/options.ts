export const PROJECT_WORK_REPORT_TASK_SCOPES = [
  "all",
  "completed",
  "selected",
] as const

export type ProjectWorkReportTaskScope =
  (typeof PROJECT_WORK_REPORT_TASK_SCOPES)[number]

export const DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE: ProjectWorkReportTaskScope =
  "completed"

const MAX_SELECTED_TASK_IDS = 2000

/**
 * V1 sections. `design` is reserved so later we can append Diseño de Obra
 * without rewriting the execution report.
 */
export const PROJECT_WORK_REPORT_SECTIONS_V1 = {
  cover: true,
  summary: true,
  execution: true,
  design: false,
} as const

export type ProjectWorkReportOptions = {
  taskScope: ProjectWorkReportTaskScope
  selectedTaskIds: string[]
}

export function isProjectWorkReportTaskScope(
  value: unknown
): value is ProjectWorkReportTaskScope {
  return value === "all" || value === "completed" || value === "selected"
}

export function normalizeProjectWorkReportSelectedTaskIds(
  value: unknown
): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : []

  const unique: string[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (typeof item !== "string") {
      continue
    }
    const id = item.trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    unique.push(id)
    if (unique.length >= MAX_SELECTED_TASK_IDS) {
      break
    }
  }

  return unique
}

export function parseProjectWorkReportOptions(
  value: unknown
): ProjectWorkReportOptions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  if (!isProjectWorkReportTaskScope(record.taskScope)) {
    return null
  }

  const selectedTaskIds =
    record.taskScope === "selected"
      ? normalizeProjectWorkReportSelectedTaskIds(record.selectedTaskIds)
      : []

  if (record.taskScope === "selected" && selectedTaskIds.length === 0) {
    return null
  }

  return {
    taskScope: record.taskScope,
    selectedTaskIds,
  }
}

export function parseProjectWorkReportOptionsFromSearch(search: {
  scope?: string | string[]
  ids?: string | string[]
}): ProjectWorkReportOptions {
  const scopeRaw = Array.isArray(search.scope) ? search.scope[0] : search.scope
  const idsRaw = Array.isArray(search.ids) ? search.ids.join(",") : search.ids
  const parsed = parseProjectWorkReportOptions({
    taskScope: isProjectWorkReportTaskScope(scopeRaw)
      ? scopeRaw
      : DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE,
    selectedTaskIds: idsRaw,
  })

  return parsed ?? createDefaultProjectWorkReportOptions()
}

export function createDefaultProjectWorkReportOptions(): ProjectWorkReportOptions {
  return {
    taskScope: DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE,
    selectedTaskIds: [],
  }
}

export function buildProjectWorkReportViewHref(
  projectId: string,
  options: ProjectWorkReportOptions
): string {
  const params = new URLSearchParams()
  params.set("scope", options.taskScope)
  if (options.taskScope === "selected" && options.selectedTaskIds.length > 0) {
    params.set("ids", options.selectedTaskIds.join(","))
  }
  return `/obras/${projectId}/informe?${params.toString()}`
}

export function buildProjectWorkReportFileName(projectCode: string): string {
  const safe =
    projectCode
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "obra"

  return `informe-obra-${safe}.pdf`
}

export function buildProjectWorkReportFilterNote(
  taskScope: ProjectWorkReportTaskScope
): string | null {
  if (taskScope === "completed") {
    return "Este informe incluye únicamente órdenes de trabajo finalizadas, excepto las órdenes de despliegue."
  }
  if (taskScope === "all") {
    return "Este informe incluye las órdenes de trabajo de la obra, excepto las órdenes de despliegue."
  }
  return "Este informe incluye únicamente las órdenes de trabajo seleccionadas."
}
