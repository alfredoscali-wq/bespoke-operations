import "server-only"

import { writeAuditLog } from "@/lib/audit/audit-service"
import type { WriteAuditLogInput } from "@/lib/audit/types"
import { createAdminClient } from "@/lib/supabase/admin"

export async function recordAuditEventServer(
  input: WriteAuditLogInput
): Promise<void> {
  const admin = createAdminClient()
  await writeAuditLog(admin, input)
}
