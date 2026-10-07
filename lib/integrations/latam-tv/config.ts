import "server-only"

export type LatamTvConfig = {
  baseUrl: string
  token: string
}

/**
 * Server-only LATAM TV credentials.
 * The token is never returned and a token pasted into the URL is discarded.
 */
export function readLatamTvConfig(
  env: NodeJS.ProcessEnv = process.env
): LatamTvConfig | null {
  const rawUrl = env.LATAM_TV_API_URL?.trim() ?? ""
  const token = env.LATAM_TV_API_TOKEN?.trim() ?? ""
  if (!rawUrl || !token) return null
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:") return null
  return { baseUrl: parsed.origin, token }
}
