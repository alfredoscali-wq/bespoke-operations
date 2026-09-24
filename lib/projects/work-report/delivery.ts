export const VERCEL_FUNCTION_RESPONSE_LIMIT_BYTES = Math.floor(4.5 * 1024 * 1024)

export const PROJECT_WORK_REPORT_SIGNED_URL_TTL_SECONDS = 600
export const PROJECT_WORK_REPORT_TEMP_RETENTION_MS = 60 * 60 * 1000
export const PROJECT_WORK_REPORT_TEMP_PREFIX = "tmp/project-work-reports"

export type ProjectWorkReportDeliveryMode = "inline" | "signed-url"

export function resolveProjectWorkReportDeliveryMode(input: {
  byteSize: number
  isVercel?: boolean
}): ProjectWorkReportDeliveryMode {
  if (input.isVercel) {
    return "signed-url"
  }

  if (input.byteSize > VERCEL_FUNCTION_RESPONSE_LIMIT_BYTES) {
    return "signed-url"
  }

  return "inline"
}

export function buildProjectWorkReportTempStoragePath(input: {
  companyId: string
  projectId: string
  fileName: string
  generatedAtMs: number
  uniqueId: string
}): string {
  const companyId = input.companyId.trim()
  const projectId = input.projectId.trim()
  const uniqueId = input.uniqueId.replace(/[^A-Za-z0-9-]/g, "")
  const fileName = input.fileName.replace(/[/\\]/g, "-")

  return [
    PROJECT_WORK_REPORT_TEMP_PREFIX,
    companyId,
    `${input.generatedAtMs}-${projectId}-${uniqueId}-${fileName}`,
  ].join("/")
}

export function companyIdFromWorkReportTempPath(storagePath: string): string | null {
  const parts = storagePath.split("/")
  if (
    parts.length < 4 ||
    parts[0] !== "tmp" ||
    parts[1] !== "project-work-reports" ||
    !parts[2]
  ) {
    return null
  }

  return parts[2]
}

export function isWorkReportTempPathOwnedByCompany(
  storagePath: string,
  companyId: string
): boolean {
  return companyIdFromWorkReportTempPath(storagePath) === companyId.trim()
}

export function generatedAtMsFromWorkReportTempObjectName(
  objectName: string
): number | null {
  const match = /^(\d+)-/.exec(objectName)
  if (!match) {
    return null
  }

  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

export function isExpiredWorkReportTempObject(input: {
  objectName: string
  nowMs: number
  retentionMs?: number
}): boolean {
  const generatedAtMs = generatedAtMsFromWorkReportTempObjectName(
    input.objectName
  )
  if (generatedAtMs == null) {
    return false
  }

  const retentionMs = input.retentionMs ?? PROJECT_WORK_REPORT_TEMP_RETENTION_MS
  return input.nowMs - generatedAtMs > retentionMs
}

export type ProjectWorkReportSignedUrlPayload = {
  success: true
  delivery: "signed-url"
  signedUrl: string
  fileName: string
  byteSize: number
  expiresInSeconds: number
  includedCount: number
}

export function buildProjectWorkReportSignedUrlPayload(input: {
  signedUrl: string
  fileName: string
  byteSize: number
  expiresInSeconds: number
  includedCount: number
}): ProjectWorkReportSignedUrlPayload {
  return {
    success: true,
    delivery: "signed-url",
    signedUrl: input.signedUrl,
    fileName: input.fileName,
    byteSize: input.byteSize,
    expiresInSeconds: input.expiresInSeconds,
    includedCount: input.includedCount,
  }
}

export function signedUrlPayloadFitsFunctionLimit(
  payload: ProjectWorkReportSignedUrlPayload
): boolean {
  return (
    Buffer.byteLength(JSON.stringify(payload), "utf8") <=
    VERCEL_FUNCTION_RESPONSE_LIMIT_BYTES
  )
}
