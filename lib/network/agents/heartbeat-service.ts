import "server-only"

import { applyNetworkAgentHeartbeat } from "@/lib/network/agents/queries"
import { recordNetworkAgentStatusChangedActivity } from "@/lib/network/activity"
import { recordNetworkAgentStatusChangedAudit } from "@/lib/network/audit"
import { isNetworkAgentStatus, resolveTrustedCompanyId } from "@/lib/network/integrity"
import type { NetworkAgentAuth } from "@/lib/network/v1/agent-auth"
import type { NetworkHeartbeatReport } from "@/lib/network/types"
import { createAdminClient } from "@/lib/supabase/admin"

export async function recordNetworkAgentHeartbeat(
  auth: NetworkAgentAuth,
  report: NetworkHeartbeatReport,
  claimedCompanyId?: unknown
): Promise<{
  agentId: string
  companyId: string
  status: string
  lastSeenAt: string
}> {
  const companyId = resolveTrustedCompanyId(auth.companyId, claimedCompanyId)
  const lastSeenAt = new Date().toISOString()
  const nextStatus = report.status ?? (auth.status === "pending" ? "online" : auth.status)
  const version = report.version === undefined ? auth.version : report.version
  const hostname = report.hostname === undefined ? auth.hostname : report.hostname

  const admin = createAdminClient()
  const updated = await applyNetworkAgentHeartbeat(admin, auth.agentId, companyId, {
    status: nextStatus,
    version,
    hostname,
    lastSeenAt,
  })

  const fromStatus = isNetworkAgentStatus(auth.status) ? auth.status : "pending"
  const toStatus = isNetworkAgentStatus(updated.status) ? updated.status : nextStatus

  if (fromStatus !== toStatus) {
    try {
      await recordNetworkAgentStatusChangedActivity({
        companyId,
        agentId: updated.id,
        agentName: updated.name,
        fromStatus,
        toStatus,
      })
      await recordNetworkAgentStatusChangedAudit({
        companyId,
        agentId: updated.id,
        agentName: updated.name,
        fromStatus,
        toStatus,
      })
    } catch (error) {
      console.error("[Network API] heartbeat audit/activity failed", error)
    }
  }

  return {
    agentId: updated.id,
    companyId,
    status: updated.status,
    lastSeenAt: updated.last_seen_at ?? lastSeenAt,
  }
}
