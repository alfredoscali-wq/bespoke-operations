import {
  normalizeActivityRecordInput,
  validateActivityRecordInput,
} from "@/lib/activity-engine/activity-validate"
import type {
  ActivityCategory,
  ActivityEngineEvent,
  ActivityEngineRecordInput,
  ActivityEngineRecordResult,
  ActivityImpact,
  ActivityOrigin,
} from "@/lib/activity-engine/activity-types"

type ActivityEngineDbRow = {
  id: string
  company_id: string
  module: string
  entity_type: string
  entity_id: string
  employee_id: string | null
  action: string
  category: string
  impact: string
  origin: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
}

/** Minimal client surface — real Supabase admin client or test mock. */
export type ActivityEngineWriteClient = {
  rpc: (
    fn: "record_activity_engine_event",
    args: {
      p_company_id: string
      p_module: string
      p_entity_type: string
      p_entity_id: string
      p_employee_id: string | null
      p_action: string
      p_category: string
      p_impact: string
      p_origin: string
      p_metadata: Record<string, unknown>
    }
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  from: (table: "activity_events") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        single: () => Promise<{
          data: ActivityEngineDbRow | null
          error: { message: string } | null
        }>
      }
    }
  }
}

function mapRow(row: ActivityEngineDbRow): ActivityEngineEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    module: row.module,
    entityType: row.entity_type,
    entityId: row.entity_id,
    employeeId: row.employee_id,
    action: row.action,
    category: row.category as ActivityCategory,
    impact: row.impact as ActivityImpact,
    origin: row.origin as ActivityOrigin,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  }
}

/**
 * Central writer given an admin/service-role client.
 * Prefer `activity.record()` from app server code.
 */
export async function persistActivityRecordWithClient(
  client: ActivityEngineWriteClient,
  input: ActivityEngineRecordInput
): Promise<ActivityEngineRecordResult> {
  const normalized = normalizeActivityRecordInput(input)
  const validationError = validateActivityRecordInput(normalized)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const { data: eventId, error: rpcError } = await client.rpc(
    "record_activity_engine_event",
    {
      p_company_id: normalized.companyId,
      p_module: normalized.module,
      p_entity_type: normalized.entityType,
      p_entity_id: normalized.entityId,
      p_employee_id: normalized.employeeId ?? null,
      p_action: normalized.action,
      p_category: normalized.category,
      p_impact: normalized.impact,
      p_origin: normalized.origin,
      p_metadata: normalized.metadata ?? {},
    }
  )

  if (rpcError || !eventId) {
    return {
      ok: false,
      error: {
        code: "PERSISTENCE_ERROR",
        message:
          rpcError?.message ??
          "No se pudo registrar el evento en activity_events.",
      },
    }
  }

  const { data, error } = await client
    .from("activity_events")
    .select(
      "id, company_id, module, entity_type, entity_id, employee_id, action, category, impact, origin, metadata, created_at, updated_at"
    )
    .eq("id", eventId as string)
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: {
        code: "PERSISTENCE_ERROR",
        message:
          error?.message ??
          "Evento insertado pero no se pudo leer desde activity_events.",
      },
    }
  }

  return { ok: true, data: mapRow(data) }
}
