import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { createAdminClient } from "@/lib/supabase/admin"

import {
  evaluateProjectWorkReportShareAccess,
  publicShareDenialMessage,
  shareBelongsToCompanyProject,
} from "@/lib/projects/work-report/share-access"
import {
  createProjectWorkReportShareToken,
  decryptProjectWorkReportShareToken,
  encryptProjectWorkReportShareToken,
  hashProjectWorkReportSharePassword,
  hashProjectWorkReportShareToken,
  resolveProjectWorkReportShareSecret,
  verifyProjectWorkReportSharePassword,
} from "@/lib/projects/work-report/share-crypto"
import type { ProjectWorkReportShareCreateInput } from "@/lib/projects/work-report/share-options"
import { resolveProjectWorkReportShareExpiresAt } from "@/lib/projects/work-report/share-options"
import { buildProjectWorkReportShareUrl } from "@/lib/projects/work-report/public-origin"
import {
  mapProjectReportShareRow,
  projectReportSharesTable,
  type ProjectReportShare,
} from "@/lib/projects/work-report/share-table"

export type ProjectWorkReportShareStatus = {
  active: boolean
  isPasswordProtected: boolean
  expiresAt: string | null
  createdAt: string | null
  url: string | null
  taskScope: "all" | "completed" | "selected" | null
}

function emptyShareStatus(): ProjectWorkReportShareStatus {
  return {
    active: false,
    isPasswordProtected: false,
    expiresAt: null,
    createdAt: null,
    url: null,
    taskScope: null,
  }
}

function resolveShareSecretOrThrow(): string {
  const secret = resolveProjectWorkReportShareSecret()
  if (!secret) {
    throw new Error("Falta la clave de cifrado del informe compartido.")
  }
  return secret
}

export function toProjectWorkReportShareStatus(
  share: ProjectReportShare | null,
  now: Date = new Date()
): ProjectWorkReportShareStatus {
  if (!share) {
    return emptyShareStatus()
  }

  const access = evaluateProjectWorkReportShareAccess(share, now)
  if (!access.ok) {
    return emptyShareStatus()
  }

  const secret = resolveProjectWorkReportShareSecret()
  const token = secret
    ? decryptProjectWorkReportShareToken(share.tokenCiphertext, secret)
    : null

  return {
    active: true,
    isPasswordProtected: share.isPasswordProtected,
    expiresAt: share.expiresAt,
    createdAt: share.createdAt,
    url: token ? buildProjectWorkReportShareUrl(token) : null,
    taskScope: share.taskScope,
  }
}

export async function findActiveProjectReportShare(input: {
  client: SupabaseClient<Database>
  companyId: string
  projectId: string
}): Promise<ProjectReportShare | null> {
  const result = await projectReportSharesTable(input.client)
    .select("*")
    .eq("company_id", input.companyId)
    .eq("project_id", input.projectId)
    .is("revoked_at", null)
    .maybeSingle()

  if (result.error || !result.data) {
    return null
  }

  const share = mapProjectReportShareRow(result.data)
  if (!shareBelongsToCompanyProject(share, input.companyId, input.projectId)) {
    return null
  }

  return share
}

export async function findProjectReportShareByToken(
  token: string,
  client: SupabaseClient<Database> = createAdminClient()
): Promise<ProjectReportShare | null> {
  const tokenHash = hashProjectWorkReportShareToken(token)
  const result = await projectReportSharesTable(client)
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (result.error || !result.data) {
    return null
  }

  return mapProjectReportShareRow(result.data)
}

export async function revokeActiveProjectReportShare(input: {
  client: SupabaseClient<Database>
  companyId: string
  projectId: string
}): Promise<ProjectReportShare | null> {
  const current = await findActiveProjectReportShare(input)
  if (!current) {
    return null
  }

  const result = await projectReportSharesTable(input.client)
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .eq("company_id", input.companyId)
    .eq("project_id", input.projectId)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle()

  if (result.error || !result.data) {
    return current
  }

  return mapProjectReportShareRow(result.data)
}

export async function createProjectReportShare(input: {
  client: SupabaseClient<Database>
  companyId: string
  projectId: string
  createdBy: string | null
  payload: ProjectWorkReportShareCreateInput
}): Promise<
  | { ok: true; share: ProjectReportShare; url: string; token: string }
  | { ok: false; status: 400 | 409 | 500; message: string; share?: ProjectReportShare }
> {
  const password = input.payload.password?.trim() ?? ""
  if (input.payload.passwordProtected && password.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "Ingrese una contraseña para proteger el informe.",
    }
  }

  const existing = await findActiveProjectReportShare({
    client: input.client,
    companyId: input.companyId,
    projectId: input.projectId,
  })

  if (existing && !input.payload.regenerate) {
    return {
      ok: false,
      status: 409,
      message: "Ya existe un informe compartido activo.",
      share: existing,
    }
  }

  if (existing && input.payload.regenerate) {
    await revokeActiveProjectReportShare({
      client: input.client,
      companyId: input.companyId,
      projectId: input.projectId,
    })
  }

  const secret = resolveShareSecretOrThrow()
  const token = createProjectWorkReportShareToken()
  const tokenHash = hashProjectWorkReportShareToken(token)
  const tokenCiphertext = encryptProjectWorkReportShareToken(token, secret)
  const passwordHash = input.payload.passwordProtected
    ? await hashProjectWorkReportSharePassword(password)
    : null

  const insert = await projectReportSharesTable(input.client)
    .insert({
      company_id: input.companyId,
      project_id: input.projectId,
      token_hash: tokenHash,
      token_ciphertext: tokenCiphertext,
      password_hash: passwordHash,
      is_password_protected: input.payload.passwordProtected,
      task_scope: input.payload.taskScope,
      selected_task_ids: input.payload.selectedTaskIds,
      expires_at: resolveProjectWorkReportShareExpiresAt(input.payload.expiresIn),
      created_by: input.createdBy,
    })
    .select("*")
    .single()

  if (insert.error || !insert.data) {
    return {
      ok: false,
      status: 500,
      message: insert.error?.message ?? "No se pudo crear el enlace del informe.",
    }
  }

  const share = mapProjectReportShareRow(insert.data)
  return {
    ok: true,
    share,
    token,
    url: buildProjectWorkReportShareUrl(token),
  }
}

export async function resolvePublicProjectReportShare(token: string): Promise<
  | { ok: true; share: ProjectReportShare }
  | { ok: false; reason: "not_found" | "revoked" | "expired"; message: string }
> {
  const share = await findProjectReportShareByToken(token)
  const access = evaluateProjectWorkReportShareAccess(share)
  if (!share || !access.ok) {
    return {
      ok: false,
      reason: access.ok ? "not_found" : access.reason,
      message: publicShareDenialMessage(),
    }
  }

  return { ok: true, share }
}

export async function verifyPublicProjectReportSharePassword(
  share: ProjectReportShare,
  password: string
): Promise<boolean> {
  if (!share.isPasswordProtected) {
    return true
  }

  return verifyProjectWorkReportSharePassword(password, share.passwordHash)
}
