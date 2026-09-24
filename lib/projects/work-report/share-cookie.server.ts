import "server-only"

import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

import {
  PROJECT_WORK_REPORT_SHARE_COOKIE_NAME,
  PROJECT_WORK_REPORT_SHARE_SESSION_TTL_SECONDS,
  sessionMatchesShare,
  signProjectWorkReportShareSession,
  verifyProjectWorkReportShareSession,
  type ProjectWorkReportShareSessionPayload,
} from "@/lib/projects/work-report/share-session"
import { resolveProjectWorkReportShareSecret } from "@/lib/projects/work-report/share-crypto"
import { shareSessionMaxAgeSeconds } from "@/lib/projects/work-report/share-options"
import type { ProjectReportShare } from "@/lib/projects/work-report/share-table"

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function applyProjectWorkReportShareSessionCookie(
  response: NextResponse,
  share: ProjectReportShare,
  now: Date = new Date()
): void {
  const secret = resolveProjectWorkReportShareSecret()
  if (!secret) {
    return
  }

  const maxAge = shareSessionMaxAgeSeconds(
    share.expiresAt,
    now,
    PROJECT_WORK_REPORT_SHARE_SESSION_TTL_SECONDS
  )
  if (maxAge <= 0) {
    return
  }

  const value = signProjectWorkReportShareSession(
    {
      sid: share.id,
      th: share.tokenHash,
      exp: Math.floor(now.getTime() / 1000) + maxAge,
    },
    secret
  )
  response.cookies.set(
    PROJECT_WORK_REPORT_SHARE_COOKIE_NAME,
    value,
    cookieOptions(maxAge)
  )
}

export async function readProjectWorkReportShareSession(): Promise<ProjectWorkReportShareSessionPayload | null> {
  const secret = resolveProjectWorkReportShareSecret()
  if (!secret) {
    return null
  }

  const store = await cookies()
  return verifyProjectWorkReportShareSession(
    store.get(PROJECT_WORK_REPORT_SHARE_COOKIE_NAME)?.value,
    secret
  )
}

export function publicShareViewerIsUnlocked(
  share: ProjectReportShare,
  session: ProjectWorkReportShareSessionPayload | null
): boolean {
  if (!share.isPasswordProtected) {
    return true
  }

  if (!session) {
    return false
  }

  return sessionMatchesShare(session, share)
}
