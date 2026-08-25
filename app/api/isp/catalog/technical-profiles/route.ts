import { NextResponse } from "next/server"

import type { IspTechnicalProfileDraft } from "@/lib/isp/catalog-types"
import {
  requireIspReadContext,
  requireIspWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"
import {
  createIspTechnicalProfile,
  listIspTechnicalProfiles,
} from "@/lib/isp/technical-profile-queries"

export async function GET(request: Request) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const status = url.searchParams.get("status")

  try {
    const client = await createClient()
    const items = await listIspTechnicalProfiles(client, auth.companyId, {
      activeOnly: status === "active",
    })
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los perfiles técnicos.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  let draft: IspTechnicalProfileDraft
  try {
    draft = (await request.json()) as IspTechnicalProfileDraft
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const item = await createIspTechnicalProfile(client, auth.companyId, draft)
    return NextResponse.json({ success: true, item })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear el perfil técnico.",
      },
      { status: 400 }
    )
  }
}
