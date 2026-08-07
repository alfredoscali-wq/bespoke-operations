/**
 * Sprint 33.0 / 41.0 — auth.getUser() with per-request-chain reuse.
 *
 * 1) Prefer proxy-validated user from signed request header (0–5 ms).
 * 2) Else call supabase.auth.getUser() once (network).
 * 3) React.cache dedupes concurrent callers in the same server request.
 *
 * Sprint 41.0 — verify HMAC on the proxy cache; never trust a forged header.
 */

import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import type { AuthError, User } from "@supabase/supabase-js"

import {
  AUTH_USER_REQUEST_CACHE_NONE,
  BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER,
  BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER_LEGACY,
  decodeAuthUserRequestCacheValue,
} from "@/lib/auth/auth-user-request-cache"
import { createClient } from "@/lib/supabase/server"

export type AuthUserLookupResult = {
  user: User | null
  error: AuthError | null
  fromCache: boolean
  durationMs: number
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

async function loadAuthUserUncached(): Promise<AuthUserLookupResult> {
  const started = nowMs()

  try {
    const headerStore = await headers()
    const cachedRaw =
      headerStore.get(BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER) ??
      headerStore.get(BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER_LEGACY)

    if (cachedRaw != null) {
      if (cachedRaw === AUTH_USER_REQUEST_CACHE_NONE) {
        return {
          user: null,
          error: null,
          fromCache: true,
          durationMs: nowMs() - started,
        }
      }

      const decoded = await decodeAuthUserRequestCacheValue(cachedRaw)
      if (decoded.valid) {
        return {
          user: decoded.user,
          error: null,
          fromCache: true,
          durationMs: nowMs() - started,
        }
      }
      // Corrupt/forged/unsigned-when-secret-required — fall through to network.
    }
  } catch {
    // headers() unavailable outside a request — fall through to network.
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return {
    user: user ?? null,
    error: error ?? null,
    fromCache: false,
    durationMs: nowMs() - started,
  }
}

/**
 * Request-scoped auth user. Safe to call repeatedly in one handler tree.
 * When proxy already validated the JWT, this is a cache hit (no second getUser).
 */
export const getAuthUser = cache(loadAuthUserUncached)
