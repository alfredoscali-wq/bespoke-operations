/**
 * Sprint 33.0 / 41.0 — share validated auth user across proxy → server handlers.
 * Edge-safe helpers (no Node/server-only APIs).
 *
 * Sprint 41.0 — shorter header name + HMAC signature so handlers can trust the
 * proxy-validated payload without a second auth.getUser() network round-trip.
 */

import type { User } from "@supabase/supabase-js"

/** Internal request header set by proxy after auth.getUser(). */
export const BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER = "x-bespoke-auc"

/** @deprecated Sprint 41.0 — kept for one release to ignore stale client values. */
export const BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER_LEGACY =
  "x-bespoke-auth-user-request-cache"

/** Sentinel: proxy validated the request and there is no authenticated user. */
export const AUTH_USER_REQUEST_CACHE_NONE = "-"

type AuthUserCachePayload = {
  id: string
  email?: string | null
  phone?: string | null
  aud?: string
  role?: string
  user_metadata?: User["user_metadata"]
  app_metadata?: User["app_metadata"]
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64")
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const padLength = (4 - (padded.length % 4)) % 4
  const base64 = padded + "=".repeat(padLength)
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary")
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i)! ^ b.charCodeAt(i)!
  }
  return mismatch === 0
}

async function hmacSha256Base64Url(
  secret: string,
  message: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  )
  return bytesToBase64Url(new Uint8Array(signature))
}

/**
 * Secret used to sign the proxy → handler auth cache.
 * Prefers a dedicated secret; falls back to service role / anon key.
 */
export function resolveAuthUserRequestCacheSecret(): string | null {
  const dedicated = process.env.BESPOKE_AUTH_USER_CACHE_SECRET?.trim()
  if (dedicated) return dedicated
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (serviceRole) return serviceRole
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (anon) return anon
  return null
}

export function serializeAuthUserForRequestCache(user: User): string {
  const payload: AuthUserCachePayload = {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    aud: user.aud,
    role: user.role,
    user_metadata: user.user_metadata ?? {},
    app_metadata: user.app_metadata ?? {},
  }
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

export function deserializeAuthUserFromRequestCache(
  raw: string
): User | null {
  if (!raw || raw === AUTH_USER_REQUEST_CACHE_NONE) {
    return null
  }

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(raw))
    const payload = JSON.parse(json) as AuthUserCachePayload
    if (!payload || typeof payload.id !== "string" || !payload.id) {
      return null
    }

    return {
      id: payload.id,
      email: payload.email ?? undefined,
      phone: payload.phone ?? undefined,
      aud: payload.aud ?? "authenticated",
      role: payload.role ?? "authenticated",
      user_metadata: payload.user_metadata ?? {},
      app_metadata: payload.app_metadata ?? {},
      created_at: "",
      identities: [],
      factors: [],
    } as User
  } catch {
    return null
  }
}

export async function encodeAuthUserRequestCacheValue(
  user: User | null,
  secret: string | null = resolveAuthUserRequestCacheSecret()
): Promise<string> {
  if (!user) return AUTH_USER_REQUEST_CACHE_NONE
  const body = serializeAuthUserForRequestCache(user)
  if (!secret) {
    // Dev / misconfigured env — still forward unsigned body (Sprint 33 behavior).
    return body
  }
  const signature = await hmacSha256Base64Url(secret, body)
  return `${body}.${signature}`
}

/**
 * Accepts signed (`body.sig`) or legacy unsigned body (Sprint 33).
 * Signed values require a valid HMAC when a secret is configured.
 */
export async function decodeAuthUserRequestCacheValue(
  raw: string,
  secret: string | null = resolveAuthUserRequestCacheSecret()
): Promise<{ user: User | null; valid: boolean }> {
  if (!raw) {
    return { user: null, valid: false }
  }

  if (raw === AUTH_USER_REQUEST_CACHE_NONE) {
    return { user: null, valid: true }
  }

  const dot = raw.lastIndexOf(".")
  if (dot > 0) {
    const body = raw.slice(0, dot)
    const signature = raw.slice(dot + 1)
    if (!secret) {
      // Secret missing on handler — do not trust signed payloads blindly.
      return { user: null, valid: false }
    }
    const expected = await hmacSha256Base64Url(secret, body)
    if (!timingSafeEqualString(signature, expected)) {
      return { user: null, valid: false }
    }
    const user = deserializeAuthUserFromRequestCache(body)
    return { user, valid: Boolean(user) }
  }

  // Legacy unsigned payload: only accept when no secret is configured
  // (local/dev). With a secret, require signatures (Sprint 41.0).
  if (secret) {
    return { user: null, valid: false }
  }

  const user = deserializeAuthUserFromRequestCache(raw)
  return { user, valid: Boolean(user) }
}
