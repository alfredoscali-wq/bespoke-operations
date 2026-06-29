const BEARER_PREFIX = /^Bearer\s+(.+)$/i

/**
 * Extracts the access token from `Authorization: Bearer <token>`.
 * Returns null when the header is missing or malformed.
 */
export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")

  if (!authorization) {
    return null
  }

  const match = authorization.match(BEARER_PREFIX)
  const token = match?.[1]?.trim()

  return token || null
}
