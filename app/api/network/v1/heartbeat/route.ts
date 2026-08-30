import { parseHeartbeatReport } from "@/lib/network/integrity"
import { recordNetworkAgentHeartbeat } from "@/lib/network/agents/heartbeat-service"
import { handleProtectedNetworkAgentRoute } from "@/lib/network/v1/handle-network-route"
import { networkApiErrorResponse } from "@/lib/network/v1/error-factory"
import { networkApiSuccessResponse } from "@/lib/network/v1/response-factory"

export async function POST(request: Request) {
  return handleProtectedNetworkAgentRoute(request, async (context, auth) => {
    let body: unknown = {}
    try {
      const text = await request.text()
      if (text.trim()) {
        body = JSON.parse(text) as unknown
      }
    } catch {
      return networkApiErrorResponse(
        context,
        "INVALID_REQUEST",
        "Cuerpo JSON inválido.",
        400
      )
    }

    const parsed = parseHeartbeatReport(body)
    if (!parsed.ok) {
      return networkApiErrorResponse(
        context,
        "INVALID_REQUEST",
        parsed.message,
        400
      )
    }

    const claimedCompanyId =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).companyId ??
          (body as Record<string, unknown>).company_id
        : undefined

    const result = await recordNetworkAgentHeartbeat(
      auth,
      parsed.report,
      claimedCompanyId
    )

    return networkApiSuccessResponse(context, result)
  })
}
