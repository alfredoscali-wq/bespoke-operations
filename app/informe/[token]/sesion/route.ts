import { NextResponse } from "next/server"

import {
  applyProjectWorkReportShareSessionCookie,
  publicShareViewerIsUnlocked,
  readProjectWorkReportShareSession,
} from "@/lib/projects/work-report/share-cookie.server"
import {
  resolvePublicProjectReportShare,
  verifyPublicProjectReportSharePassword,
} from "@/lib/projects/work-report/share.server"
import { publicShareDenialMessage } from "@/lib/projects/work-report/share-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ token: string }>
}

function redirectToInforme(request: Request, token: string, error?: string) {
  const url = new URL(`/informe/${encodeURIComponent(token)}`, request.url)
  if (error) {
    url.searchParams.set("error", error)
  }
  return NextResponse.redirect(url)
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params
  if (!token?.trim()) {
    return NextResponse.json(
      { success: false, message: publicShareDenialMessage() },
      { status: 404 }
    )
  }

  const resolved = await resolvePublicProjectReportShare(token)
  if (!resolved.ok) {
    return redirectToInforme(request, token, "unavailable")
  }

  const contentType = request.headers.get("content-type") ?? ""
  let password = ""
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { password?: unknown }
      password = typeof body.password === "string" ? body.password : ""
    } catch {
      password = ""
    }
  } else {
    const form = await request.formData()
    password = String(form.get("password") ?? "")
  }

  const accepted = await verifyPublicProjectReportSharePassword(
    resolved.share,
    password
  )
  if (!accepted) {
    return redirectToInforme(request, token, "password")
  }

  const response = redirectToInforme(request, token)
  applyProjectWorkReportShareSessionCookie(response, resolved.share)
  return response
}

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params
  if (!token?.trim()) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  const resolved = await resolvePublicProjectReportShare(token)
  if (!resolved.ok) {
    return redirectToInforme(request, token, "unavailable")
  }

  const session = await readProjectWorkReportShareSession()
  if (!publicShareViewerIsUnlocked(resolved.share, session)) {
    return redirectToInforme(request, token)
  }

  return redirectToInforme(request, token)
}
