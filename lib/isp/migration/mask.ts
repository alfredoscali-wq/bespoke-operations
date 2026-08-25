import {
  ISP_MIGRATION_HIDDEN_SECRET,
  ISP_MIGRATION_SENSITIVE_FIELDS,
} from "@/lib/isp/migration/constants"
import type { IspMigrationIssue } from "@/lib/isp/migration/types"

export function isSensitiveMigrationField(field: string): boolean {
  return (ISP_MIGRATION_SENSITIVE_FIELDS as readonly string[]).includes(field)
}

export function maskMigrationSecret(value: string | null | undefined): string {
  if (!value) return ""
  return ISP_MIGRATION_HIDDEN_SECRET
}

export function displayMigrationIssueValue(
  field: string,
  value: string
): string {
  if (isSensitiveMigrationField(field) && value) {
    return ISP_MIGRATION_HIDDEN_SECRET
  }
  return value
}

export function maskMigrationPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...payload }
  for (const field of ISP_MIGRATION_SENSITIVE_FIELDS) {
    if (typeof next[field] === "string" && String(next[field]).length > 0) {
      next[field] = ISP_MIGRATION_HIDDEN_SECRET
    }
  }
  if (next._source && typeof next._source === "object" && !Array.isArray(next._source)) {
    next._source = maskMigrationPayload(next._source as Record<string, unknown>)
  }
  return next
}

export function maskMigrationIssues(
  issues: IspMigrationIssue[]
): IspMigrationIssue[] {
  return issues.map((issue) => ({
    ...issue,
    value: displayMigrationIssueValue(issue.field, issue.value),
  }))
}

export function payloadContainsUnmaskedPassword(
  payload: Record<string, unknown>
): boolean {
  const password = payload.password_pppoe
  return typeof password === "string" && password.length > 0 && password !== ISP_MIGRATION_HIDDEN_SECRET
}
