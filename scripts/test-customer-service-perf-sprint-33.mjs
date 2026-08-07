/**
 * Sprint 33.0 — auth.getUser cache / reuse per request chain.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  AUTH_USER_REQUEST_CACHE_NONE,
  BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER,
  deserializeAuthUserFromRequestCache,
  encodeAuthUserRequestCacheValue,
  serializeAuthUserForRequestCache,
} from "../lib/auth/auth-user-request-cache.ts"
import {
  addReleaseExpiredTimer,
  recordReleaseExpiredQuery,
  runWithReleaseExpiredPerf,
} from "../lib/customer-service/performance/release-expired-breakdown.ts"
import { setCustomerServicePerfEnabledForTests } from "../lib/customer-service/performance/enabled.ts"

const ROOT = process.cwd()

test("Sprint 33.0: middleware forwards validated user via request-cache header", () => {
  const middleware = readFileSync(join(ROOT, "middleware.ts"), "utf8")
  assert.ok(middleware.includes("continueWithAuthUserRequestCache"))
  assert.ok(middleware.includes("supabase.auth.getUser()"))
  assert.ok(middleware.includes("recordProxyQuery(perf, \"auth.getUser\""))
})

test("Sprint 33.0: getAuthUser prefers header cache then network", () => {
  const helper = readFileSync(
    join(ROOT, "lib/auth/get-auth-user.server.ts"),
    "utf8"
  )
  assert.ok(helper.includes("BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER"))
  assert.ok(helper.includes("fromCache: true"))
  assert.ok(helper.includes("supabase.auth.getUser()"))
  assert.ok(helper.includes("cache(loadAuthUserUncached)"))
})

test("Sprint 33.0: session + release-expired use getAuthUser (no direct getUser)", () => {
  const session = readFileSync(join(ROOT, "lib/auth/session.ts"), "utf8")
  assert.ok(session.includes("getAuthUser()"))
  assert.equal(session.includes("supabase.auth.getUser()"), false)

  const releaseAuth = readFileSync(
    join(ROOT, "lib/customer-atenciones/release-expired-auth.server.ts"),
    "utf8"
  )
  assert.ok(releaseAuth.includes("getAuthUser()"))
  assert.equal(releaseAuth.includes("supabase.auth.getUser()"), false)
  assert.ok(releaseAuth.includes("cached: authLookup.fromCache"))
})

test("Sprint 33.0: serialize/deserialize round-trip preserves id + metadata", () => {
  const user = {
    id: "user-1",
    email: "a@b.com",
    user_metadata: {
      company_id: "co-1",
      employee_id: "emp-1",
      allowed_modules: ["atencion_cliente"],
    },
    app_metadata: {},
    aud: "authenticated",
    role: "authenticated",
  }

  const encoded = serializeAuthUserForRequestCache(user)
  const decoded = deserializeAuthUserFromRequestCache(encoded)
  assert.equal(decoded?.id, "user-1")
  assert.equal(decoded?.email, "a@b.com")
  assert.equal(decoded?.user_metadata?.company_id, "co-1")
  assert.equal(encodeAuthUserRequestCacheValue(null), AUTH_USER_REQUEST_CACHE_NONE)
  assert.ok(BESPOKE_AUTH_USER_REQUEST_CACHE_HEADER.startsWith("x-bespoke-"))
})

test("Sprint 33.0: RELEASE EXPIRED QUERY marks cache hits", async () => {
  setCustomerServicePerfEnabledForTests(true)
  const logs = []
  const originalInfo = console.info
  console.info = (...args) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await runWithReleaseExpiredPerf(async () => {
      addReleaseExpiredTimer("sessionUserMs", 4)
      addReleaseExpiredTimer("employeeMs", 0)
      addReleaseExpiredTimer("roleMs", 0)
      addReleaseExpiredTimer("rpcMs", 90)
      recordReleaseExpiredQuery("auth.getUser", 3, { cached: true })
      recordReleaseExpiredQuery("rpc.release_expired", 90)
    })

    const joined = logs.join("\n")
    assert.ok(joined.includes("[ATC RELEASE EXPIRED]"))
    assert.ok(joined.includes("[ATC RELEASE EXPIRED QUERY]"))
    assert.ok(joined.includes("auth.getUser"))
    assert.ok(joined.includes("(cache)"))
    assert.ok(joined.includes("rpc.release_expired"))
  } finally {
    console.info = originalInfo
    setCustomerServicePerfEnabledForTests(null)
  }
})
