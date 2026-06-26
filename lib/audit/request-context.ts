export function extractRequestAuditContext(request: Request): {
  ipAddress: string | null
  userAgent: string | null
} {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null

  return {
    ipAddress,
    userAgent: request.headers.get("user-agent"),
  }
}
