import {
  jsonMikrotikError,
  jsonMikrotikPayload,
} from "@/lib/integrations/mikrotik/http"
import {
  requireMikrotikReadSession,
  requireMikrotikWriteSession,
} from "@/lib/integrations/mikrotik/session"
import {
  deleteCompanyMikrotikIntegration,
  getCompanyMikrotikIntegration,
  updateCompanyMikrotikIntegration,
} from "@/lib/integrations/mikrotik/service"
import { parseMikrotikUpdateInput } from "@/lib/integrations/mikrotik/validate"
import { MikrotikIntegrationError } from "@/lib/integrations/mikrotik/errors"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireMikrotikReadSession()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    const integration = await getCompanyMikrotikIntegration(auth.companyId, id)
    if (!integration) {
      throw new MikrotikIntegrationError("NOT_FOUND", 404)
    }
    return jsonMikrotikPayload({ success: true, integration })
  } catch (error) {
    return jsonMikrotikError(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireMikrotikWriteSession()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonMikrotikPayload(
      { success: false, message: "Cuerpo JSON invalido." },
      400
    )
  }

  const parsed = parseMikrotikUpdateInput(body)
  if (!parsed.ok) {
    return jsonMikrotikPayload({ success: false, message: parsed.message }, 400)
  }

  try {
    const integration = await updateCompanyMikrotikIntegration({
      companyId: auth.companyId,
      id,
      sessionUser: auth.sessionUser,
      body: parsed.value,
    })
    return jsonMikrotikPayload({ success: true, integration })
  } catch (error) {
    return jsonMikrotikError(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireMikrotikWriteSession()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  try {
    await deleteCompanyMikrotikIntegration({
      companyId: auth.companyId,
      id,
      sessionUser: auth.sessionUser,
    })
    return jsonMikrotikPayload({ success: true })
  } catch (error) {
    return jsonMikrotikError(error)
  }
}
