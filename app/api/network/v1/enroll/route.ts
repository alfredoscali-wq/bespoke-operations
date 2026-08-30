import { parseEnrollRequest } from "@/lib/network/integrity"
import { enrollNetworkAgent } from "@/lib/network/agents/enroll-service"
import { handlePublicNetworkRoute } from "@/lib/network/v1/handle-network-route"
import { networkApiErrorResponse } from "@/lib/network/v1/error-factory"
import { networkApiSuccessResponse } from "@/lib/network/v1/response-factory"

export async function POST(request: Request) {
  return handlePublicNetworkRoute(async (context) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return networkApiErrorResponse(
        context,
        "INVALID_REQUEST",
        "Cuerpo JSON inválido.",
        400
      )
    }

    const parsed = parseEnrollRequest(body)
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

    const result = await enrollNetworkAgent({
      enrollmentToken: parsed.enrollmentToken,
      version: parsed.version,
      hostname: parsed.hostname,
      claimedCompanyId,
    })

    return networkApiSuccessResponse(context, result, 201)
  })
}
