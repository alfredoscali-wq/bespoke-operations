import { NextResponse } from "next/server"

import { requireObraWorkReportSession } from "@/lib/projects/work-report/require-obra-session"
import { parseProjectWorkReportShareCreateInput } from "@/lib/projects/work-report/share-options"
import {
  createProjectReportShare,
  findActiveProjectReportShare,
  toProjectWorkReportShareStatus,
} from "@/lib/projects/work-report/share.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params
  const loaded = await requireObraWorkReportSession(projectId)
  if (!loaded.ok) {
    return loaded.response
  }

  const share = await findActiveProjectReportShare({
    client: loaded.value.client,
    companyId: loaded.value.companyId,
    projectId: loaded.value.projectId,
  })

  return NextResponse.json({
    success: true,
    share: toProjectWorkReportShareStatus(share),
  })
}

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params
  const loaded = await requireObraWorkReportSession(projectId)
  if (!loaded.ok) {
    return loaded.response
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

  const payload = parseProjectWorkReportShareCreateInput(body)
  if (!payload) {
    return NextResponse.json(
      { success: false, message: "Datos de compartir inválidos." },
      { status: 400 }
    )
  }

  const result = await createProjectReportShare({
    client: loaded.value.client,
    companyId: loaded.value.companyId,
    projectId: loaded.value.projectId,
    createdBy: loaded.value.sessionUser.authUserId,
    payload,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        share: result.share
          ? toProjectWorkReportShareStatus(result.share)
          : undefined,
      },
      { status: result.status }
    )
  }

  return NextResponse.json({
    success: true,
    share: toProjectWorkReportShareStatus(result.share),
    url: result.url,
  })
}
