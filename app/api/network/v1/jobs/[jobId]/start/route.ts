import { startAuthorizedNetworkAgentJob } from "@/lib/network/jobs/agent-execution"
import { handleProtectedNetworkAgentRoute } from "@/lib/network/v1/handle-network-route"
import { networkApiSuccessResponse } from "@/lib/network/v1/response-factory"

type RouteContext = { params: Promise<{ jobId: string }> }

export async function POST(request: Request, context: RouteContext) {
  return handleProtectedNetworkAgentRoute(request, async (contextInfo, auth) => {
    const { jobId } = await context.params
    const result = await startAuthorizedNetworkAgentJob(auth, jobId)
    return networkApiSuccessResponse(contextInfo, result)
  })
}
