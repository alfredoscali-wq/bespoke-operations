import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

export const PROJECT_REPORT_SHARES_TABLE = "project_report_shares"

export type ProjectReportShareRow = {
  id: string
  company_id: string
  project_id: string
  token_hash: string
  token_ciphertext: string
  password_hash: string | null
  is_password_protected: boolean
  task_scope: "all" | "completed" | "selected"
  selected_task_ids?: string[] | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
  created_by: string | null
  updated_at: string
}

export type ProjectReportShare = {
  id: string
  companyId: string
  projectId: string
  tokenHash: string
  tokenCiphertext: string
  passwordHash: string | null
  isPasswordProtected: boolean
  taskScope: "all" | "completed" | "selected"
  selectedTaskIds: string[]
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  createdBy: string | null
  updatedAt: string
}

type SharesQuery = {
  select: (columns: string) => SharesQuery
  insert: (
    values: Record<string, unknown> | Record<string, unknown>[]
  ) => SharesQuery
  update: (values: Record<string, unknown>) => SharesQuery
  eq: (column: string, value: string) => SharesQuery
  is: (column: string, value: null) => SharesQuery
  maybeSingle: () => Promise<{ data: ProjectReportShareRow | null; error: { message: string } | null }>
  single: () => Promise<{ data: ProjectReportShareRow | null; error: { message: string } | null }>
}

export function projectReportSharesTable(
  client: SupabaseClient<Database>
): SharesQuery {
  return (
    client as unknown as { from: (relation: string) => SharesQuery }
  ).from(PROJECT_REPORT_SHARES_TABLE)
}

export function mapProjectReportShareRow(
  row: ProjectReportShareRow
): ProjectReportShare {
  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    tokenHash: row.token_hash,
    tokenCiphertext: row.token_ciphertext,
    passwordHash: row.password_hash,
    isPasswordProtected: row.is_password_protected,
    taskScope: row.task_scope,
    selectedTaskIds: Array.isArray(row.selected_task_ids)
      ? row.selected_task_ids.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      : [],
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  }
}
