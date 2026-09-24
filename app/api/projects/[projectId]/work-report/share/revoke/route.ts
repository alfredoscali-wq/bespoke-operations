import { NextResponse } from "next/server"

import { requireObraWorkReportSession } from "@/lib/projects/work-report/require-obra-session"
import {
  revokeActiveProjectReportShare,
  toProjectWorkReportShareStatus,
} from "@/lib/projects/work-report/share.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params
  const loaded = await requireObraWorkReportSession(projectId)
  if (!loaded.ok) {
    return loaded.response
  }

  const revoked = await revokeActiveProjectReportShare({
    client: loaded.value.client,
    companyId: loaded.value.companyId,
    projectId: loaded.value.projectId,
  })

  if (!revoked) {
    return NextResponse.json(
      { success: false, message: "No hay un informe compartido activo." },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    share: toProjectWorkReportShareStatus(null),
  })
}
