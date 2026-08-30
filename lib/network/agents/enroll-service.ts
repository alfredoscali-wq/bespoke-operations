import "server-only"

import { NETWORK_ENROLLMENT_TOKEN_TTL_MS } from "@/lib/network/constants"
import {
  completeNetworkAgentEnrollment,
  findNetworkAgentByEnrollmentHash,
} from "@/lib/network/agents/queries"
import { recordNetworkAgentEnrolledActivity } from "@/lib/network/activity"
import { recordNetworkAgentEnrolledAudit } from "@/lib/network/audit"
import { resolveTrustedCompanyId } from "@/lib/network/integrity"
import {
  generateNetworkAgentToken,
  hashNetworkSecret,
  isNetworkEnrollmentToken,
} from "@/lib/network/tokens"
import {
  NETWORK_API_ERROR_MESSAGES,
  NetworkApiError,
} from "@/lib/network/v1/errors"
import { createAdminClient } from "@/lib/supabase/admin"

export async function enrollNetworkAgent(input: {
  enrollmentToken: string
  version: string | null
  hostname: string | null
  claimedCompanyId?: unknown
}): Promise<{
  agentId: string
  companyId: string
  siteId: string | null
  agentToken: string
  status: string
}> {
  if (!isNetworkEnrollmentToken(input.enrollmentToken)) {
    throw new NetworkApiError(
      "UNAUTHORIZED",
      NETWORK_API_ERROR_MESSAGES.UNAUTHORIZED,
      401
    )
  }

  const admin = createAdminClient()
  const pending = await findNetworkAgentByEnrollmentHash(
    admin,
    hashNetworkSecret(input.enrollmentToken)
  )

  if (!pending) {
    throw new NetworkApiError(
      "AGENT_NOT_FOUND",
      NETWORK_API_ERROR_MESSAGES.AGENT_NOT_FOUND,
      404
    )
  }

  if (pending.credential_token_hash || pending.enrolled_at) {
    throw new NetworkApiError(
      "ENROLLMENT_CONSUMED",
      NETWORK_API_ERROR_MESSAGES.ENROLLMENT_CONSUMED,
      409
    )
  }

  if (
    pending.enrollment_expires_at &&
    new Date(pending.enrollment_expires_at).getTime() < Date.now()
  ) {
    throw new NetworkApiError(
      "ENROLLMENT_EXPIRED",
      NETWORK_API_ERROR_MESSAGES.ENROLLMENT_EXPIRED,
      410
    )
  }

  const companyId = resolveTrustedCompanyId(
    pending.company_id,
    input.claimedCompanyId
  )

  const agentToken = generateNetworkAgentToken()
  const enrolled = await completeNetworkAgentEnrollment(
    admin,
    pending.id,
    companyId,
    {
      credentialTokenHash: hashNetworkSecret(agentToken),
      version: input.version,
      hostname: input.hostname,
    }
  )

  try {
    await recordNetworkAgentEnrolledActivity({
      companyId,
      agentId: enrolled.id,
      agentName: enrolled.name,
      siteId: enrolled.site_id,
    })
    await recordNetworkAgentEnrolledAudit({
      companyId,
      agentId: enrolled.id,
      agentName: enrolled.name,
      siteId: enrolled.site_id,
    })
  } catch (error) {
    console.error("[Network API] enroll audit/activity failed", error)
  }

  return {
    agentId: enrolled.id,
    companyId,
    siteId: enrolled.site_id,
    agentToken,
    status: enrolled.status,
  }
}

export function enrollmentExpiresAt(now = Date.now()): string {
  return new Date(now + NETWORK_ENROLLMENT_TOKEN_TTL_MS).toISOString()
}
