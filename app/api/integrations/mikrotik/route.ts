import {
  parseMikrotikCreateInput,
} from "@/lib/integrations/mikrotik/validate"
import {
  jsonMikrotikError,
  jsonMikrotikPayload,
} from "@/lib/integrations/mikrotik/http"
import {
  requireMikrotikReadSession,
  requireMikrotikWriteSession,
} from "@/lib/integrations/mikrotik/session"
import {
  createCompanyMikrotikIntegration,
  listCompanyMikrotikIntegrations,
} from "@/lib/integrations/mikrotik/service"

export async function GET() {
  const auth = await requireMikrotikReadSession()
  if (!auth.ok) return auth.response

  try {
    const integrations = await listCompanyMikrotikIntegrations(auth.companyId)
    return jsonMikrotikPayload({ success: true, integrations })
  } catch (error) {
    return jsonMikrotikError(error)
  }
}

export async function POST(request: Request) {
  const auth = await requireMikrotikWriteSession()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonMikrotikPayload(
      { success: false, message: "Cuerpo JSON invalido." },
      400
    )
  }

  const parsed = parseMikrotikCreateInput(body)
  if (!parsed.ok) {
    return jsonMikrotikPayload({ success: false, message: parsed.message }, 400)
  }

  try {
    const integration = await createCompanyMikrotikIntegration({
      companyId: auth.companyId,
      sessionUser: auth.sessionUser,
      body: parsed.value,
    })
    return jsonMikrotikPayload({ success: true, integration }, 201)
  } catch (error) {
    return jsonMikrotikError(error)
  }
}
