import { jsonMikrotikError, jsonMikrotikPayload } from "@/lib/integrations/mikrotik/http"
import { requireMikrotikReadSession } from "@/lib/integrations/mikrotik/session"
import { getCompanyMikrotikStatus } from "@/lib/integrations/mikrotik/service"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireMikrotikReadSession()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const integration = await getCompanyMikrotikStatus(auth.companyId, id)
    const snapshot = integration.lastRouterIdentity
    return jsonMikrotikPayload({
      success: true,
      integration,
      summary: snapshot
        ? {
            identity: snapshot.identity,
            version: snapshot.version,
            uptime: snapshot.uptime,
            cpuLoad: snapshot.cpuLoad,
            freeMemory: snapshot.freeMemory,
            totalMemory: snapshot.totalMemory,
            boardName: snapshot.boardName,
          }
        : null,
    })
  } catch (error) {
    return jsonMikrotikError(error)
  }
}
