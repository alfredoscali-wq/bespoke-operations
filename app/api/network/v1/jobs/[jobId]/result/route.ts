import { submitNetworkAgentJobResult } from "@/lib/network/jobs/agent-execution"
import { handleProtectedNetworkAgentRoute } from "@/lib/network/v1/handle-network-route"
import { networkApiErrorResponse } from "@/lib/network/v1/error-factory"
import { networkApiSuccessResponse } from "@/lib/network/v1/response-factory"

type RouteContext = { params: Promise<{ jobId: string }> }

export async function POST(request: Request, context: RouteContext) {
  return handleProtectedNetworkAgentRoute(request, async (contextInfo, auth) => {
    const { jobId } = await context.params
    let body: unknown = {}
    try {
      const text = await request.text()
      if (text.trim()) body = JSON.parse(text) as unknown
    } catch {
      return networkApiErrorResponse(
        contextInfo,
        "INVALID_REQUEST",
        "Cuerpo JSON inválido.",
        400
      )
    }

    const claimedCompanyId =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).companyId ??
          (body as Record<string, unknown>).company_id
        : undefined

    const result = await submitNetworkAgentJobResult({
      auth,
      jobId,
      body,
      claimedCompanyId,
    })

    return networkApiSuccessResponse(contextInfo, result)
  })
}
