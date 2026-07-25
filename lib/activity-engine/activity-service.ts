import "server-only"

import {
  persistActivityRecordWithClient,
  type ActivityEngineWriteClient,
} from "@/lib/activity-engine/activity-persist-core"
import type {
  ActivityEngineRecordInput,
  ActivityEngineRecordResult,
} from "@/lib/activity-engine/activity-types"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"

export {
  normalizeActivityRecordInput,
  validateActivityRecordInput,
} from "@/lib/activity-engine/activity-validate"

export { persistActivityRecordWithClient } from "@/lib/activity-engine/activity-persist-core"

/**
 * Server helper: persist with the admin (service_role) client.
 */
export async function persistActivityRecord(
  input: ActivityEngineRecordInput,
  client: SupabaseAdminClient = createAdminClient()
): Promise<ActivityEngineRecordResult> {
  return persistActivityRecordWithClient(
    client as unknown as ActivityEngineWriteClient,
    input
  )
}
