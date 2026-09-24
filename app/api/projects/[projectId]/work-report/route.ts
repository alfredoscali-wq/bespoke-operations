import { NextResponse } from "next/server"

import {
  jsonFromSessionAuthFailure,
  requireLoadedPasswordCompliantSession,
} from "@/lib/auth/require-password-compliant-session"
import { getSessionUser } from "@/lib/auth/session"
import { canAccessObrasModuleForStart } from "@/lib/projects/obra-task-insert-integrity"
import {
  buildProjectWorkReportSignedUrlPayload,
  resolveProjectWorkReportDeliveryMode,
  signedUrlPayloadFitsFunctionLimit,
} from "@/lib/projects/work-report/delivery"
import { buildProjectWorkReportPdfForCompany } from "@/lib/projects/work-report/build-pdf.server"
import { parseProjectWorkReportOptions } from "@/lib/projects/work-report/options"
import { persistProjectWorkReportPdfForDownload } from "@/lib/projects/work-report/temp-storage.server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const loaded = requireLoadedPasswordCompliantSession(
    await getSessionUser(),
    "Debe iniciar sesión para exportar el informe."
  )
  if (!loaded.ok) {
    return loaded.response
  }

  if (!canAccessObrasModuleForStart(loaded.sessionUser)) {
    return NextResponse.json(
      {
        success: false,
        message: "No tiene permiso para operar el módulo Obras.",
      },
      { status: 403 }
    )
  }

  const companyId = loaded.sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return jsonFromSessionAuthFailure({
      status: 403,
      message: "No se pudo resolver la compañía del usuario.",
    })
  }

  const { projectId } = await context.params
  if (!projectId?.trim()) {
    return NextResponse.json(
      { success: false, message: "Obra no encontrada." },
      { status: 404 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const options = parseProjectWorkReportOptions(body)
  if (!options) {
    return NextResponse.json(
      { success: false, message: "Filtro de informe inválido." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await buildProjectWorkReportPdfForCompany({
    client,
    companyId,
    projectId: projectId.trim(),
    options,
  })

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.status }
    )
  }

  const byteSize = result.pdf.byteLength
  const mode = resolveProjectWorkReportDeliveryMode({
    byteSize,
    isVercel: process.env.VERCEL === "1",
  })

  if (mode === "inline") {
    return new NextResponse(Buffer.from(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  try {
    const stored = await persistProjectWorkReportPdfForDownload({
      companyId,
      projectId: projectId.trim(),
      fileName: result.fileName,
      pdf: result.pdf,
    })

    const payload = buildProjectWorkReportSignedUrlPayload({
      signedUrl: stored.signedUrl,
      fileName: result.fileName,
      byteSize,
      expiresInSeconds: stored.expiresInSeconds,
      includedCount: result.includedCount,
    })

    if (!signedUrlPayloadFitsFunctionLimit(payload)) {
      return NextResponse.json(
        { success: false, message: "No se pudo preparar la descarga del informe." },
        { status: 500 }
      )
    }

    return NextResponse.json(payload)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo preparar la descarga del informe."
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
