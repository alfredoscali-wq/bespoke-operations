/**
 * Sprint 41.0 — Eliminate double auth.getUser() between proxy and ATC endpoints.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import {
  AUTH_USER_REQUEST_CACHE_NONE,
  BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER,
  decodeAuthUserRequestCacheValue,
  encodeAuthUserRequestCacheValue,
  serializeAuthUserForRequestCache,
} from "../lib/auth/auth-user-request-cache.ts"

const ROOT = process.cwd()

const ACTION_AUTH =
  "lib/customer-atenciones/action-auth.server.ts"
const RELEASE_AUTH =
  "lib/customer-atenciones/release-expired-auth.server.ts"
const GET_AUTH_USER = "lib/auth/get-auth-user.server.ts"
const CONTINUE = "lib/auth/continue-with-auth-user-request-cache.ts"
const PROXY = "proxy.ts"

test("Sprint 41.0: proxy.ts replaces middleware.ts and exports proxy()", () => {
  assert.equal(existsSync(join(ROOT, "middleware.ts")), false)
  assert.equal(existsSync(join(ROOT, PROXY)), true)

  const proxy = readFileSync(join(ROOT, PROXY), "utf8")
  assert.ok(/export async function proxy\(/.test(proxy))
  assert.ok(proxy.includes("continueWithAuthUserRequestCache"))
  assert.ok(proxy.includes("nextWithoutAuthUserRequestCache"))
  assert.ok(proxy.includes("supabase.auth.getUser()"))
  assert.equal(proxy.includes("export async function middleware"), false)
})

test("Sprint 41.0: ATC action + release-expired auth use getAuthUser (no direct getUser)", () => {
  for (const relative of [ACTION_AUTH, RELEASE_AUTH]) {
    const source = readFileSync(join(ROOT, relative), "utf8")
    assert.ok(source.includes("getAuthUser()"), `${relative} must use getAuthUser`)
    assert.equal(
      source.includes("supabase.auth.getUser()"),
      false,
      `${relative} must not call auth.getUser directly`
    )
  }

  const actionAuth = readFileSync(join(ROOT, ACTION_AUTH), "utf8")
  assert.ok(actionAuth.includes("Sprint 41.0"))
})

test("Sprint 41.0: getAuthUser verifies signed proxy cache before network", () => {
  const helper = readFileSync(join(ROOT, GET_AUTH_USER), "utf8")
  assert.ok(helper.includes("decodeAuthUserRequestCacheValue"))
  assert.ok(helper.includes("BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER"))
  assert.ok(helper.includes("fromCache: true"))
  assert.ok(helper.includes("supabase.auth.getUser()"))
})

test("Sprint 41.0: continueWith forwards synced cookies + signed cache", () => {
  const source = readFileSync(join(ROOT, CONTINUE), "utf8")
  assert.ok(source.includes("encodeAuthUserRequestCacheValue"))
  assert.ok(source.includes("request.cookies.getAll()"))
  assert.ok(source.includes("nextWithoutAuthUserRequestCache"))
  assert.ok(
    source.includes("BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER_LEGACY")
  )
  assert.ok(source.includes("buildForwardedRequestHeaders"))
})

test("Sprint 41.0: signed cache round-trip; forged signature rejected", async () => {
  const secret = "sprint-41-test-secret"
  const user = {
    id: "user-1",
    email: "a@b.com",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: {
      company_id: "co-1",
      employee_id: "emp-1",
      allowed_modules: ["atencion_cliente"],
    },
    app_metadata: {},
  }

  const encoded = await encodeAuthUserRequestCacheValue(user, secret)
  assert.notEqual(encoded, AUTH_USER_REQUEST_CACHE_NONE)
  assert.ok(encoded.includes("."))

  const decoded = await decodeAuthUserRequestCacheValue(encoded, secret)
  assert.equal(decoded.valid, true)
  assert.equal(decoded.user?.id, "user-1")
  assert.equal(decoded.user?.user_metadata?.company_id, "co-1")

  const forged = `${serializeAuthUserForRequestCache(user)}.not-a-real-signature`
  const rejected = await decodeAuthUserRequestCacheValue(forged, secret)
  assert.equal(rejected.valid, false)
  assert.equal(rejected.user, null)

  assert.equal(
    await encodeAuthUserRequestCacheValue(null, secret),
    AUTH_USER_REQUEST_CACHE_NONE
  )
  assert.ok(BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER.startsWith("x-bespoke-"))
})

test("Sprint 41.0: unsigned payload rejected when secret is configured", async () => {
  const secret = "sprint-41-test-secret"
  const user = {
    id: "user-2",
    email: "b@c.com",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: {},
    app_metadata: {},
  }
  const unsigned = serializeAuthUserForRequestCache(user)
  const rejected = await decodeAuthUserRequestCacheValue(unsigned, secret)
  assert.equal(rejected.valid, false)
})
