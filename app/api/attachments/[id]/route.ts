import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { canDeleteAttachments } from "@/lib/attachments"
import { deleteAttachment } from "@/lib/attachments/service.server"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  if (!canDeleteAttachments(auth.sessionUser)) {
    return NextResponse.json(
      {
        success: false,
        message: "Solo un Administrador puede eliminar adjuntos.",
        code: "FORBIDDEN",
      },
      { status: 403 }
    )
  }

  const companyId = auth.sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "No se pudo resolver la empresa de la sesión." },
      { status: 403 }
    )
  }

  const { id } = await context.params
  const attachmentId = id?.trim() ?? ""
  if (!attachmentId) {
    return NextResponse.json(
      { success: false, message: "id de adjunto inválido." },
      { status: 400 }
    )
  }

  const result = await deleteAttachment({ companyId, attachmentId })
  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo eliminar el adjunto.",
        code: result.error?.code,
      },
      { status: result.error?.code === "NOT_FOUND" ? 404 : 500 }
    )
  }

  return NextResponse.json({ success: true, id: result.data.id })
}
