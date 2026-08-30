import { NextResponse } from "next/server"

import { insertPendingNetworkAgent, listNetworkAgents } from "@/lib/network/agents/queries"
import { enrollmentExpiresAt } from "@/lib/network/agents/enroll-service"
import { validateNetworkAgentDraft } from "@/lib/network/integrity"
import { getNetworkSite } from "@/lib/network/sites/queries"
import {
  generateNetworkEnrollmentToken,
  hashNetworkSecret,
} from "@/lib/network/tokens"
import { mapNetworkAgentRow } from "@/lib/network/mapper"
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
    const agents = await listNetworkAgents(client, auth.companyId)
    return NextResponse.json({ success: true, agents })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudieron cargar los agents.",
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

  const parsed = validateNetworkAgentDraft(
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
    let siteName: string | null = null
    if (parsed.siteId) {
      const site = await getNetworkSite(client, auth.companyId, parsed.siteId)
      if (!site) {
        return NextResponse.json(
          { success: false, message: "Sitio no encontrado." },
          { status: 404 }
        )
      }
      siteName = site.name
    }

    const enrollmentToken = generateNetworkEnrollmentToken()
    const row = await insertPendingNetworkAgent(client, {
      companyId: auth.companyId,
      siteId: parsed.siteId,
      name: parsed.name,
      enrollmentTokenHash: hashNetworkSecret(enrollmentToken),
      enrollmentExpiresAt: enrollmentExpiresAt(),
    })

    return NextResponse.json(
      {
        success: true,
        agent: mapNetworkAgentRow(row, siteName),
        enrollmentToken,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo registrar el agent.",
      },
      { status: 500 }
    )
  }
}
