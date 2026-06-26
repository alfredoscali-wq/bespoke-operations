import "server-only"

import {
  isAuditAction,
  resolveAuditActionDefinition,
  resolveAuditSeverity,
} from "@/lib/audit/audit-catalog"
import {
  resolveNextEntityAuditRevision,
  shouldAssignEntityAuditRevision,
} from "@/lib/audit/entity-revision"
import { SYSTEM_AUDIT_ACTOR_NAME } from "@/lib/audit/system-actor"
import type {
  AuditLogEntry,
  AuditLogQuery,
  AuditLogQueryResult,
  WriteAuditLogInput,
} from "@/lib/audit/types"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"

type SystemAuditLogRow = {
  id: string
  module: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  description: string
  severity: string
  performed_by_user_id: string | null
  performed_by_name: string
  performed_by_role: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function mapAuditLogRow(row: SystemAuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    module: row.module as AuditLogEntry["module"],
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    description: row.description,
    severity: row.severity as AuditLogEntry["severity"],
    performedByUserId: row.performed_by_user_id,
    performedByName: row.performed_by_name,
    performedByRole: row.performed_by_role,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

function resolvePerformedByFields(input: WriteAuditLogInput) {
  if (input.performedBy.kind === "system") {
    return {
      performed_by_user_id: null,
      performed_by_name: SYSTEM_AUDIT_ACTOR_NAME,
      performed_by_role: null,
    }
  }

  return {
    performed_by_user_id: input.performedBy.sessionUser.authUserId,
    performed_by_name: input.performedBy.sessionUser.displayName,
    performed_by_role: input.performedBy.sessionUser.systemRole,
  }
}

export function validateWriteAuditLogInput(input: WriteAuditLogInput): void {
  if (!isAuditAction(input.action)) {
    throw new Error(`Acción de auditoría no reconocida: ${input.action}`)
  }

  const definition = resolveAuditActionDefinition(input.action)

  if (input.module !== definition.module) {
    throw new Error(
      `El módulo ${input.module} no corresponde a la acción ${input.action}.`
    )
  }

  if (input.entityType !== definition.entityType) {
    throw new Error(
      `La entidad ${input.entityType} no corresponde a la acción ${input.action}.`
    )
  }

  if (!input.description.trim()) {
    throw new Error("La descripción del evento de auditoría es obligatoria.")
  }
}

export async function writeAuditLog(
  client: SupabaseAdminClient,
  input: WriteAuditLogInput
): Promise<AuditLogEntry> {
  validateWriteAuditLogInput(input)

  const performedBy = resolvePerformedByFields(input)
  const severity = input.severity ?? resolveAuditSeverity(input.action)

  let metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
  }

  if (shouldAssignEntityAuditRevision(input)) {
    metadata = {
      ...metadata,
      revision: await resolveNextEntityAuditRevision(client, {
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
      }),
    }
  }

  const { data, error } = await client
    .from("system_audit_log")
    .insert({
      module: input.module,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      description: input.description.trim(),
      severity,
      ...performedBy,
      ip_address: input.ipAddress?.trim() || null,
      user_agent: input.userAgent?.trim() || null,
      metadata,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(
      `No se pudo registrar el Historial del Sistema: ${error?.message ?? "Error desconocido"}`
    )
  }

  return mapAuditLogRow(data as SystemAuditLogRow)
}

export async function queryAuditLogs(
  client: SupabaseAdminClient,
  input: AuditLogQuery = {}
): Promise<AuditLogQueryResult> {
  const page = Math.max(input.page ?? 1, 1)
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = client
    .from("system_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })

  if (input.module) {
    query = query.eq("module", input.module)
  }

  if (input.action) {
    query = query.eq("action", input.action)
  }

  if (input.entityType) {
    query = query.eq("entity_type", input.entityType)
  }

  if (input.entityId) {
    query = query.eq("entity_id", input.entityId)
  }

  if (input.severity) {
    query = query.eq("severity", input.severity)
  }

  if (input.performedByUserId) {
    query = query.eq("performed_by_user_id", input.performedByUserId)
  }

  if (input.from) {
    query = query.gte("created_at", input.from)
  }

  if (input.to) {
    query = query.lte("created_at", input.to)
  }

  if (input.search?.trim()) {
    const term = input.search.trim()
    query = query.or(
      `description.ilike.%${term}%,entity_label.ilike.%${term}%,performed_by_name.ilike.%${term}%`
    )
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    throw new Error(`No se pudo consultar el Historial del Sistema: ${error.message}`)
  }

  return {
    entries: (data ?? []).map((row) => mapAuditLogRow(row as SystemAuditLogRow)),
    total: count ?? 0,
    page,
    limit,
  }
}
