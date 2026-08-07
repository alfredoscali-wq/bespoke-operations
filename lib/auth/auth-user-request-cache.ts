/**
 * Sprint 33.0 — share validated auth user across middleware → server handlers.
 * Edge-safe helpers (no Node/server-only APIs).
 */

import type { User } from "@supabase/supabase-js"

/** Internal request header set by middleware after auth.getUser(). */
export const BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER =
  "x-bespoke-auth-user-request-cache"

/** Sentinel: middleware validated the request and there is no authenticated user. */
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

export function encodeAuthUserRequestCacheValue(
  user: User | null
): string {
  if (!user) return AUTH_USER_REQUEST_CACHE_NONE
  return serializeAuthUserForRequestCache(user)
}
