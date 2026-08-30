const BEARER_PREFIX = /^Bearer\s+(.+)$/i

export function extractNetworkBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")
  if (!authorization) return null
  const match = authorization.match(BEARER_PREFIX)
  const token = match?.[1]?.trim()
  return token || null
}

export type NetworkRequestContext = {
  requestId: string
}

export function createNetworkRequestContext(): NetworkRequestContext {
  return {
    requestId: crypto.randomUUID(),
  }
}

export function getNetworkApiServerTime(): string {
  return new Date().toISOString()
}
