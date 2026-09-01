import { NextResponse } from "next/server"

import {
  deleteIspCatalogItem,
  getIspCatalogItem,
  setIspCatalogActive,
  updateIspCatalogItem,
} from "@/lib/isp/catalog-queries"
import {
  ISP_CATALOG_IN_USE_CODE,
  isIspCatalogInUseError,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogDraft } from "@/lib/isp/catalog-types"
import {
  requireIspReadContext,
  requireIspWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const client = await createClient()
    const item = await getIspCatalogItem(client, auth.companyId, id)
    if (!item) {
      return NextResponse.json(
        { success: false, message: "Servicio no encontrado." },
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
            : "No se pudo cargar el servicio.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: (Partial<IspCatalogDraft> & { isActive?: boolean }) | IspCatalogDraft
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
      const item = await setIspCatalogActive(
        client,
        auth.companyId,
        id,
        body.isActive
      )
      return NextResponse.json({ success: true, item })
    }

    const item = await updateIspCatalogItem(
      client,
      auth.companyId,
      id,
      body as IspCatalogDraft
    )
    return NextResponse.json({ success: true, item })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el servicio.",
      },
      { status: 400 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const client = await createClient()
    await deleteIspCatalogItem(client, auth.companyId, id)
    return NextResponse.json({ success: true, deleted: true })
  } catch (error) {
    if (isIspCatalogInUseError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: ISP_CATALOG_IN_USE_CODE,
          message: error.message,
        },
        { status: 409 }
      )
    }
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar el servicio."
    const status = message === "Servicio no encontrado." ? 404 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
