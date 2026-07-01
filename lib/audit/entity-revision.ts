import "server-only"

import {
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  type AuditEntityType,
  type AuditModule,
} from "@/lib/audit/types"
import { isValidAuditEntityId } from "@/lib/audit/entity-id"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"

export function parseAuditRevision(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value)
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return 0
}

export async function resolveNextEntityAuditRevision(
  client: SupabaseAdminClient,
  input: {
    module: AuditModule
    entityType: AuditEntityType
    entityId: string
  }
): Promise<number> {
  const { data, error } = await client
    .from("system_audit_log")
    .select("metadata")
    .eq("module", input.module)
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return 1
  }

  return parseAuditRevision(data?.metadata?.revision) + 1
}

const REVISION_TRACKED_ENTITIES = new Set<AuditEntityType>([
  AUDIT_ENTITY_TYPES.TASK,
  AUDIT_ENTITY_TYPES.PROJECT,
  AUDIT_ENTITY_TYPES.EMPLOYEE,
  AUDIT_ENTITY_TYPES.CREW,
  AUDIT_ENTITY_TYPES.USER,
])

export function shouldAssignEntityAuditRevision(input: {
  module: string
  entityType: string
  entityId?: string | null
}): input is {
  module: AuditModule
  entityType: AuditEntityType
  entityId: string
} {
  return (
    (input.module === AUDIT_MODULES.TAREAS ||
      input.module === AUDIT_MODULES.OBRAS ||
      input.module === AUDIT_MODULES.RRHH ||
      input.module === AUDIT_MODULES.USUARIOS) &&
    REVISION_TRACKED_ENTITIES.has(input.entityType as AuditEntityType) &&
    typeof input.entityId === "string" &&
    isValidAuditEntityId(input.entityId)
  )
}

/** @deprecated Use resolveNextEntityAuditRevision */
export async function resolveNextTaskAuditRevision(
  client: SupabaseAdminClient,
  entityId: string
): Promise<number> {
  return resolveNextEntityAuditRevision(client, {
    module: AUDIT_MODULES.TAREAS,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId,
  })
}

/** @deprecated Use shouldAssignEntityAuditRevision */
export function shouldAssignTaskAuditRevision(input: {
  module: string
  entityType: string
  entityId?: string | null
}) {
  return shouldAssignEntityAuditRevision(input)
}
