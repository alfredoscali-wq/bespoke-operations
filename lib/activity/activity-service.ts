import "server-only"

import { recordActivityEventWithClient } from "@/lib/activity/record-activity-event-core"
import type {
  ActivityEventRow,
  RecordActivityEventInput,
} from "@/lib/activity/types"
import { createAdminClient } from "@/lib/supabase/admin"

export { recordActivityEventWithClient } from "@/lib/activity/record-activity-event-core"

/**
 * Central OIE / Activity Engine writer. All modules must use this helper.
 * Does not dual-write to system_audit_log.
 *
 * Alias: `recordActivity` (OIE 1.0 naming).
 */
export async function recordActivityEvent(
  input: RecordActivityEventInput
): Promise<ActivityEventRow> {
  return recordActivityEventWithClient(createAdminClient(), input)
}

/** OIE product name for the same writer as `recordActivityEvent`. */
export const recordActivity = recordActivityEvent

/**
 * Best-effort wrapper for instrumentation — never throws to callers.
 */
export async function recordActivityEventSafe(
  input: RecordActivityEventInput
): Promise<ActivityEventRow | null> {
  try {
    return await recordActivityEvent(input)
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
