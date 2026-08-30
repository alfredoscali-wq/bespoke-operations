import { handleProtectedNetworkAgentRoute } from "@/lib/network/v1/handle-network-route"
import { networkApiSuccessResponse } from "@/lib/network/v1/response-factory"

export async function GET(request: Request) {
  return handleProtectedNetworkAgentRoute(request, async (context, auth) =>
    networkApiSuccessResponse(context, {
      agentId: auth.agentId,
      companyId: auth.companyId,
      siteId: auth.siteId,
      name: auth.name,
      status: auth.status,
      version: auth.version,
      hostname: auth.hostname,
      lastSeenAt: auth.lastSeenAt,
    })
  )
}
