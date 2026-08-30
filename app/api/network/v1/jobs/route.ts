import { claimAuthorizedNetworkAgentJob } from "@/lib/network/jobs/agent-execution"
import { handleProtectedNetworkAgentRoute } from "@/lib/network/v1/handle-network-route"
import { networkApiSuccessResponse } from "@/lib/network/v1/response-factory"

export async function GET(request: Request) {
  return handleProtectedNetworkAgentRoute(request, async (context, auth) => {
    const claimed = await claimAuthorizedNetworkAgentJob(auth)
    return networkApiSuccessResponse(context, claimed)
  })
}
