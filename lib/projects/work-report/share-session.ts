import { createHmac, timingSafeEqual } from "node:crypto"

import { timingSafeStringEqual } from "@/lib/projects/work-report/share-crypto"

export const PROJECT_WORK_REPORT_SHARE_COOKIE_NAME = "bespoke_wr_share"
export const PROJECT_WORK_REPORT_SHARE_SESSION_TTL_SECONDS = 8 * 60 * 60

export type ProjectWorkReportShareSessionPayload = {
  v: 1
  sid: string
  th: string
  exp: number
}

export function signProjectWorkReportShareSession(
  payload: Omit<ProjectWorkReportShareSessionPayload, "v">,
  secret: string
): string {
  const body: ProjectWorkReportShareSessionPayload = {
    v: 1,
    sid: payload.sid,
    th: payload.th,
    exp: payload.exp,
  }
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url")
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url")
  return `${encoded}.${signature}`
}

export function verifyProjectWorkReportShareSession(
  value: string | null | undefined,
  secret: string,
  now: Date = new Date()
): ProjectWorkReportShareSessionPayload | null {
  if (!value) {
    return null
  }

  const dot = value.lastIndexOf(".")
  if (dot <= 0) {
    return null
  }

  const encoded = value.slice(0, dot)
  const signature = value.slice(dot + 1)
  const expected = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url")

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as ProjectWorkReportShareSessionPayload
    if (
      payload.v !== 1 ||
      typeof payload.sid !== "string" ||
      typeof payload.th !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null
    }
    if (payload.exp * 1000 <= now.getTime()) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function sessionMatchesShare(
  session: ProjectWorkReportShareSessionPayload,
  share: { id: string; tokenHash: string }
): boolean {
  return (
    timingSafeStringEqual(session.sid, share.id) &&
    timingSafeStringEqual(session.th, share.tokenHash)
  )
}
