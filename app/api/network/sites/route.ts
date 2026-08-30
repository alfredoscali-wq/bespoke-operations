import { NextResponse } from "next/server"

import { validateNetworkSiteDraft } from "@/lib/network/integrity"
import {
  createNetworkSite,
  listNetworkSites,
} from "@/lib/network/sites/queries"
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
    const sites = await listNetworkSites(client, auth.companyId)
    return NextResponse.json({ success: true, sites })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudieron cargar los sitios.",
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

  const parsed = validateNetworkSiteDraft(
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
    const site = await createNetworkSite(client, auth.companyId, parsed.draft)
    return NextResponse.json({ success: true, site }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear el sitio.",
      },
      { status: 500 }
    )
  }
}
