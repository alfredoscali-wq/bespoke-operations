import {
  DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE,
  isProjectWorkReportTaskScope,
  normalizeProjectWorkReportSelectedTaskIds,
  type ProjectWorkReportOptions,
  type ProjectWorkReportTaskScope,
} from "@/lib/projects/work-report/options"

export const PROJECT_WORK_REPORT_SHARE_TTL_VALUES = [
  "none",
  "7",
  "30",
  "90",
] as const

export type ProjectWorkReportShareTtl =
  (typeof PROJECT_WORK_REPORT_SHARE_TTL_VALUES)[number]

export const DEFAULT_PROJECT_WORK_REPORT_SHARE_TTL: ProjectWorkReportShareTtl =
  "none"

export const PROJECT_WORK_REPORT_SHARE_TTL_OPTIONS: Array<{
  value: ProjectWorkReportShareTtl
  days: number | null
  label: string
}> = [
  { value: "none", days: null, label: "Sin vencimiento" },
  { value: "7", days: 7, label: "7 días" },
  { value: "30", days: 30, label: "30 días" },
  { value: "90", days: 90, label: "90 días" },
]

export const DEFAULT_PROJECT_WORK_REPORT_SHARE_PASSWORD_PROTECTED = true

export type ProjectWorkReportShareCreateInput = {
  taskScope: ProjectWorkReportTaskScope
  selectedTaskIds: string[]
  passwordProtected: boolean
  password: string | null
  expiresIn: ProjectWorkReportShareTtl
  regenerate: boolean
}

export function isProjectWorkReportShareTtl(
  value: unknown
): value is ProjectWorkReportShareTtl {
  return (
    value === "none" ||
    value === "7" ||
    value === "30" ||
    value === "90"
  )
}

export function resolveProjectWorkReportShareExpiresAt(
  expiresIn: ProjectWorkReportShareTtl,
  now: Date = new Date()
): string | null {
  if (expiresIn === "none") {
    return null
  }

  const days = Number(expiresIn)
  const expires = new Date(now.getTime())
  expires.setUTCDate(expires.getUTCDate() + days)
  return expires.toISOString()
}

export function parseProjectWorkReportShareCreateInput(
  value: unknown
): ProjectWorkReportShareCreateInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const taskScope = isProjectWorkReportTaskScope(record.taskScope)
    ? record.taskScope
    : DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE

  const selectedTaskIds =
    taskScope === "selected"
      ? normalizeProjectWorkReportSelectedTaskIds(record.selectedTaskIds)
      : []

  if (taskScope === "selected" && selectedTaskIds.length === 0) {
    return null
  }

  const passwordProtected =
    typeof record.passwordProtected === "boolean"
      ? record.passwordProtected
      : DEFAULT_PROJECT_WORK_REPORT_SHARE_PASSWORD_PROTECTED

  const expiresIn = isProjectWorkReportShareTtl(record.expiresIn)
    ? record.expiresIn
    : DEFAULT_PROJECT_WORK_REPORT_SHARE_TTL

  const password =
    typeof record.password === "string" ? record.password : null

  return {
    taskScope,
    selectedTaskIds,
    passwordProtected,
    password,
    expiresIn,
    regenerate: record.regenerate === true,
  }
}

export function projectWorkReportOptionsFromShare(share: {
  taskScope: ProjectWorkReportTaskScope
  selectedTaskIds?: string[]
}): ProjectWorkReportOptions {
  return {
    taskScope: share.taskScope,
    selectedTaskIds:
      share.taskScope === "selected" ? share.selectedTaskIds ?? [] : [],
  }
}

export function shareSessionMaxAgeSeconds(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
  defaultSeconds = 8 * 60 * 60
): number {
  if (!expiresAt) {
    return defaultSeconds
  }

  const remaining = Math.floor((Date.parse(expiresAt) - now.getTime()) / 1000)
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return 0
  }

  return Math.min(defaultSeconds, remaining)
}
