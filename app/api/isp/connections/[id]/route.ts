import { NextResponse } from "next/server"

import { ISP_CONNECTION_NOT_FOUND_MESSAGE } from "@/lib/isp/connection-delete"
import { getIspConnectionDetail } from "@/lib/isp/queries"
import {
  deleteIspConnection,
  updateIspConnection,
} from "@/lib/isp/subscriber-service-queries"
import {
  mergeConnectionEdit,
  validateConnectionUpdate,
} from "@/lib/isp/subscriber-service-integrity"
import {
  requireIspReadContext,
  requireIspWriteContext,
} from "@/lib/isp/route-context"
import type { IspConnectionDraft } from "@/lib/isp/types"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const client = await createClient()
    const detail = await getIspConnectionDetail(client, auth.companyId, id)
    if (!detail) {
      return NextResponse.json(
        { success: false, message: "Conexión no encontrada." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, detail })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la conexión.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  let body: { connection?: IspConnectionDraft }
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
    const existing = await getIspConnectionDetail(client, auth.companyId, id)
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Conexión no encontrada." },
        { status: 404 }
      )
    }
    const incoming = body.connection ?? ({} as IspConnectionDraft)
    const check = validateConnectionUpdate({
      type: incoming.connectionType || existing.connection.connectionType,
      pppoeUsername: incoming.pppoeUsername,
      pppoePassword: incoming.pppoePassword,
      existingPppoeUsername: existing.connection.pppoeUsername,
      existingPasswordSet: existing.connection.pppoePasswordSet,
      ipAddress: incoming.ipAddress,
      existingIpAddress: existing.connection.ipAddress,
    })
    if (!check.valid) {
      return NextResponse.json(
        { success: false, message: check.message },
        { status: 400 }
      )
    }
    const merged = mergeConnectionEdit(incoming, existing.connection)
    const result = await updateIspConnection(client, {
      connectionId: id,
      connection: merged,
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la conexión.",
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
    await deleteIspConnection(client, auth.companyId, id)
    return NextResponse.json({ success: true, deleted: true })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo eliminar la conexión."
    const status = message === ISP_CONNECTION_NOT_FOUND_MESSAGE ? 404 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
