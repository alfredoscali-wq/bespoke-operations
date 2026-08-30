import "server-only"

import { isDemoCompanyId } from "@/lib/demo/demo-mode"
import { findNetworkAgentByCredentialHash } from "@/lib/network/agents/queries"
import { isNetworkAgentStatus } from "@/lib/network/integrity"
import { hashNetworkSecret, isNetworkAgentToken } from "@/lib/network/tokens"
import { NETWORK_API_ERROR_MESSAGES, NetworkApiError } from "@/lib/network/v1/errors"
import { extractNetworkBearerToken } from "@/lib/network/v1/request-context"
import { createAdminClient } from "@/lib/supabase/admin"
import type { NetworkAgentStatus } from "@/lib/network/constants"

export type NetworkAgentAuth = {
  agentId: string
  companyId: string
  siteId: string | null
  name: string
  status: NetworkAgentStatus
  version: string | null
  hostname: string | null
  lastSeenAt: string | null
  isDemoTenant: boolean
}

export async function requireNetworkAgentAuth(
  request: Request
): Promise<NetworkAgentAuth> {
  const token = extractNetworkBearerToken(request)
  if (!token || !isNetworkAgentToken(token)) {
    throw new NetworkApiError(
      "UNAUTHORIZED",
      NETWORK_API_ERROR_MESSAGES.UNAUTHORIZED,
      401
    )
  }

  const admin = createAdminClient()
  const row = await findNetworkAgentByCredentialHash(
    admin,
    hashNetworkSecret(token)
  )

  if (!row) {
    throw new NetworkApiError(
      "UNAUTHORIZED",
      NETWORK_API_ERROR_MESSAGES.UNAUTHORIZED,
      401
    )
  }

  return {
    agentId: row.id,
    companyId: row.company_id,
    siteId: row.site_id,
    name: row.name,
    status: isNetworkAgentStatus(row.status) ? row.status : "pending",
    version: row.version,
    hostname: row.hostname,
    lastSeenAt: row.last_seen_at,
    isDemoTenant: isDemoCompanyId(row.company_id),
  }
}
