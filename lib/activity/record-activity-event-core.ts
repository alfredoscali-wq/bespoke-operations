import { buildActivityEventRpcArgs } from "@/lib/activity/validate"
import type {
  ActivityEventRow,
  RecordActivityEventInput,
} from "@/lib/activity/types"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"

type ActivityEventDbRow = {
  id: string
  company_id: string
  employee_id: string | null
  actor_type: ActivityEventRow["actorType"]
  module: ActivityEventRow["module"]
  entity_type: ActivityEventRow["entityType"]
  entity_id: string | null
  action: ActivityEventRow["action"]
  detail: string
  metadata: Record<string, unknown> | null
  origin: ActivityEventRow["origin"]
  correlation_id: string | null
  severity: ActivityEventRow["severity"]
  created_at: string
}

function mapActivityEventRow(row: ActivityEventDbRow): ActivityEventRow {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    actorType: row.actor_type,
    module: row.module,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    detail: row.detail,
    metadata: row.metadata ?? {},
    origin: row.origin,
    correlationId: row.correlation_id,
    severity: row.severity,
    createdAt: row.created_at,
  }
}

/**
 * Central writer given an admin/service-role client.
 * Prefer `recordActivityEvent` from activity-service.ts in app code.
 */
export async function recordActivityEventWithClient(
  client: SupabaseAdminClient,
  input: RecordActivityEventInput
): Promise<ActivityEventRow> {
  const args = buildActivityEventRpcArgs(input)

  const { data: eventId, error: rpcError } = await client.rpc(
    "record_activity_event",
    args
  )

  if (rpcError || !eventId) {
    throw new Error(
      `Activity Engine: no se pudo registrar el evento: ${rpcError?.message ?? "sin id"}`
    )
  }

  const { data, error } = await client
    .from("activity_events")
    .select("*")
    .eq("id", eventId as string)
    .single()

  if (error || !data) {
    throw new Error(
      `Activity Engine: evento insertado pero no se pudo leer: ${error?.message ?? "sin datos"}`
    )
  }

  return mapActivityEventRow(data as ActivityEventDbRow)
}
