import { NextResponse } from "next/server"

import type { IspTechnicalProfileDraft } from "@/lib/isp/catalog-types"
import {
  requireIspReadContext,
  requireIspWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"
import {
  getIspTechnicalProfile,
  setIspTechnicalProfileActive,
  updateIspTechnicalProfile,
} from "@/lib/isp/technical-profile-queries"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const client = await createClient()
    const item = await getIspTechnicalProfile(client, auth.companyId, id)
    if (!item) {
      return NextResponse.json(
        { success: false, message: "Perfil técnico no encontrado." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, item })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el perfil técnico.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: (Partial<IspTechnicalProfileDraft> & { isActive?: boolean }) | IspTechnicalProfileDraft
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    if (typeof body.isActive === "boolean" && Object.keys(body).length <= 2) {
      const item = await setIspTechnicalProfileActive(
        client,
        auth.companyId,
        id,
        body.isActive
      )
      return NextResponse.json({ success: true, item })
    }

    const item = await updateIspTechnicalProfile(
      client,
      auth.companyId,
      id,
      body as IspTechnicalProfileDraft
    )
    return NextResponse.json({ success: true, item })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el perfil técnico.",
      },
      { status: 400 }
    )
  }
}
