import "server-only"

export type DecodedJwtTiming = {
  exp: number | null
  iat: number | null
  sub: string | null
  expIso: string | null
  iatIso: string | null
  secondsUntilExp: number | null
  isExpiredAtRequest: boolean | null
}

export function decodeJwtTiming(
  accessToken: string,
  nowMs: number = Date.now()
): DecodedJwtTiming | null {
  const parts = accessToken.split(".")
  if (parts.length < 2) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as {
      exp?: number
      iat?: number
      sub?: string
    }

    const exp = typeof payload.exp === "number" ? payload.exp : null
    const iat = typeof payload.iat === "number" ? payload.iat : null
    const sub = typeof payload.sub === "string" ? payload.sub : null
    const secondsUntilExp =
      exp == null ? null : Math.round(exp - nowMs / 1000)

    return {
      exp,
      iat,
      sub,
      expIso: exp == null ? null : new Date(exp * 1000).toISOString(),
      iatIso: iat == null ? null : new Date(iat * 1000).toISOString(),
      secondsUntilExp,
      isExpiredAtRequest:
        secondsUntilExp == null ? null : secondsUntilExp <= 0,
    }
  } catch {
    return null
  }
}
