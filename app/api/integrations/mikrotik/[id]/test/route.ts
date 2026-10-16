import {
  jsonMikrotikError,
  jsonMikrotikPayload,
} from "@/lib/integrations/mikrotik/http"
import { requireMikrotikWriteSession } from "@/lib/integrations/mikrotik/session"
import { testCompanyMikrotikConnection } from "@/lib/integrations/mikrotik/service"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireMikrotikWriteSession()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const { integration, result } = await testCompanyMikrotikConnection({
      companyId: auth.companyId,
      id,
      sessionUser: auth.sessionUser,
    })
    return jsonMikrotikPayload({ success: true, integration, result })
  } catch (error) {
    return jsonMikrotikError(error)
  }
}
