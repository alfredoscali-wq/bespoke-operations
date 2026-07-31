import "server-only"

import type {
  RecordActivityInput,
  RecordActivityResult,
} from "@/lib/activity/activity-types"
import { recordActivityEventWithClient } from "@/lib/activity/record-activity-event-core"
import type {
  ActivityEventRow,
  RecordActivityEventInput,
} from "@/lib/activity/types"
import { createAdminClient } from "@/lib/supabase/admin"

export { recordActivityEventWithClient } from "@/lib/activity/record-activity-event-core"

type CanonicalActivityWriteClient = {
  rpc: (
    fn: "record_activity",
    args: {
      p_company_id: string
      p_employee_id: string | null
      p_app_user_id: string | null
      p_module: string
      p_entity_type: string
      p_entity_id: string | null
      p_action: string
      p_title: string
      p_description: string | null
      p_metadata: Record<string, unknown>
    }
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

/**
 * Central OIE / Activity Engine writer. All modules must use this helper.
 * Does not dual-write to system_audit_log.
 */
export async function recordActivityEvent(
  input: RecordActivityEventInput
): Promise<ActivityEventRow> {
  const row = await recordActivityEventWithClient(createAdminClient(), input, {
    returnRow: true,
  })
  if (!row) {
    throw new Error("Activity Engine: write succeeded but no row was returned")
  }
  return row
}

/**
 * Canonical best-effort Activity Engine entry point.
 *
 * Activity persistence must never interrupt the business operation that
 * produced the event. Failures are reported as warnings and resolve to null.
 */
export async function recordActivity(
  input: RecordActivityInput
): Promise<RecordActivityResult | null> {
  try {
    const client =
      createAdminClient() as unknown as CanonicalActivityWriteClient
    const { data, error } = await client.rpc("record_activity", {
      p_company_id: input.companyId,
      p_employee_id: input.employeeId ?? null,
      p_app_user_id: input.appUserId ?? null,
      p_module: input.module,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId ?? null,
      p_action: input.action,
      p_title: input.title,
      p_description: input.description ?? null,
      p_metadata: input.metadata ?? {},
    })

    if (error || typeof data !== "string") {
      console.warn("[activity-engine] recordActivity failed", {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        error: error?.message ?? "The RPC did not return an event ID.",
      })
      return null
    }

    return { id: data }
  } catch (error) {
    console.warn("[activity-engine] recordActivity failed", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      error,
    })
    return null
  }
}

/**
 * Best-effort wrapper for instrumentation — never throws to callers.
 * Skips the post-RPC SELECT: callers never consume the returned row.
 */
export async function recordActivityEventSafe(
  input: RecordActivityEventInput
): Promise<ActivityEventRow | null> {
  try {
    return await recordActivityEventWithClient(createAdminClient(), input, {
      returnRow: false,
    })
  } catch (error) {
    console.error("[activity-engine] recordActivityEventSafe failed", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      error,
    })
    return null
  }
}

export const recordActivitySafe = recordActivityEventSafe
