import "server-only"

import { writeAuditLog } from "@/lib/audit/audit-service"
import type { WriteAuditLogInput } from "@/lib/audit/types"
import { createAdminClient } from "@/lib/supabase/admin"

export async function recordAuditEventServer(
  input: WriteAuditLogInput
): Promise<void> {
  const admin = createAdminClient()
  // Return value unused — skip post-insert SELECT round-trip.
  await writeAuditLog(admin, input, { returnRow: false })
}
