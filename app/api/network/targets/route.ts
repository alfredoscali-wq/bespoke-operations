import { NextResponse } from "next/server"

import { getNetworkAgent } from "@/lib/network/agents/queries"
import { getNetworkSite } from "@/lib/network/sites/queries"
import { validateNetworkDiscoveryTargetDraft } from "@/lib/network/integrity"
import {
  insertNetworkDiscoveryTarget,
  listNetworkDiscoveryTargets,
} from "@/lib/network/targets/queries"
import {
  requireNetworkReadContext,
  requireNetworkWriteContext,
} from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const targets = await listNetworkDiscoveryTargets(client, auth.companyId)
    return NextResponse.json({ success: true, targets })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los destinos.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const parsed = validateNetworkDiscoveryTargetDraft(
    body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  )
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const agent = await getNetworkAgent(client, auth.companyId, parsed.draft.agentId)
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent no encontrado." },
        { status: 404 }
      )
    }

    if (parsed.draft.siteId) {
      const site = await getNetworkSite(client, auth.companyId, parsed.draft.siteId)
      if (!site) {
        return NextResponse.json(
          { success: false, message: "Sitio no encontrado." },
          { status: 404 }
        )
      }
    }

    const target = await insertNetworkDiscoveryTarget(
      client,
      auth.companyId,
      parsed.draft
    )
    return NextResponse.json({ success: true, target }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el destino MikroTik.",
      },
      { status: 500 }
    )
  }
}
