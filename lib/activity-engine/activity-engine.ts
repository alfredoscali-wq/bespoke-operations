/**
 * Activity Engine 1.1A — engine facade.
 * Server-only write path. Domains must not insert into activity_events directly.
 */

import "server-only"

import { persistActivityRecord } from "@/lib/activity-engine/activity-service"
import type { ActivityEngineRecordInput } from "@/lib/activity-engine/activity-types"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * Public API object. Use `activity.record(...)` from server code.
 */
export const activity = {
  record(
    input: ActivityEngineRecordInput,
    client?: SupabaseAdminClient
  ) {
    return client
      ? persistActivityRecord(input, client)
      : persistActivityRecord(input)
  },
} as const
