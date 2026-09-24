import { NextResponse } from "next/server"

import {
  buildProjectWorkReportSignedUrlPayload,
  resolveProjectWorkReportDeliveryMode,
  signedUrlPayloadFitsFunctionLimit,
} from "@/lib/projects/work-report/delivery"
import { buildProjectWorkReportPdfForCompany } from "@/lib/projects/work-report/build-pdf.server"
import { publicShareDenialMessage } from "@/lib/projects/work-report/share-access"
import {
  publicShareViewerIsUnlocked,
  readProjectWorkReportShareSession,
} from "@/lib/projects/work-report/share-cookie.server"
import { projectWorkReportOptionsFromShare } from "@/lib/projects/work-report/share-options"
import { resolvePublicProjectReportShare } from "@/lib/projects/work-report/share.server"
import { persistProjectWorkReportPdfForDownload } from "@/lib/projects/work-report/temp-storage.server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params
  if (!token?.trim()) {
    return NextResponse.json(
      { success: false, message: publicShareDenialMessage() },
      { status: 404 }
    )
  }

  const resolved = await resolvePublicProjectReportShare(token)
  if (!resolved.ok) {
    return NextResponse.json(
      { success: false, message: resolved.message },
      { status: 404 }
    )
  }

  const session = await readProjectWorkReportShareSession()
  if (!publicShareViewerIsUnlocked(resolved.share, session)) {
    return NextResponse.json(
      { success: false, message: "Contraseña requerida." },
      { status: 401 }
    )
  }

  const result = await buildProjectWorkReportPdfForCompany({
    client: createAdminClient(),
    companyId: resolved.share.companyId,
    projectId: resolved.share.projectId,
    options: projectWorkReportOptionsFromShare(resolved.share),
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
      companyId: resolved.share.companyId,
      projectId: resolved.share.projectId,
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
