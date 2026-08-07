/**
 * Sprint 29.0 — Proxy / auth instrumentation wiring (no behavior change).
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  beginProxyPerfSession,
  finishProxyPerfSession,
  recordProxyCall,
  recordProxyQuery,
  setProxyTimer,
} from "../lib/auth/performance/proxy-profiler.ts"
import { setAuthPerfEnabledForTests } from "../lib/auth/performance/enabled.ts"
import {
  addAuthSyncTimer,
  recordAuthSyncCall,
  recordAuthSyncQuery,
  runWithAuthSyncPerf,
} from "../lib/auth/performance/auth-sync-profiler.ts"

const ROOT = process.cwd()

test("Sprint 29.0: middleware emits PROXY BREAKDOWN / QUERY / DUPLICATE hooks", () => {
  const middleware = readFileSync(join(ROOT, "middleware.ts"), "utf8")
  assert.ok(middleware.includes("beginProxyPerfSession"))
  assert.ok(middleware.includes("finishProxyPerfSession"))
  assert.ok(middleware.includes("recordProxyCall(perf, \"getUser()\")"))
  assert.ok(middleware.includes("recordProxyQuery(perf, \"auth.getUser\""))
  assert.ok(middleware.includes("setProxyTimer(perf, \"getUserMs\""))
  assert.ok(middleware.includes("setProxyTimer(perf, \"jwtValidationMs\""))
  assert.ok(middleware.includes("loadMetadataMs"))
  assert.ok(middleware.includes("redirectLogicMs"))
})

test("Sprint 29.0: sync-my-metadata + session + sync metadata instrument AUTH SYNC", () => {
  const route = readFileSync(
    join(ROOT, "app/api/auth/sync-my-metadata/route.ts"),
    "utf8"
  )
  assert.ok(route.includes("runWithAuthSyncPerf"))

  const session = readFileSync(join(ROOT, "lib/auth/session.ts"), "utf8")
  assert.ok(session.includes("addAuthSyncTimer(\"userMs\""))
  assert.ok(session.includes("recordAuthSyncQuery(\"employees\""))
  assert.ok(session.includes("recordAuthSyncQuery(\"company_roles\""))
  assert.ok(session.includes("recordAuthSyncCall(\"getUser()\")"))
  assert.ok(session.includes("recordAuthSyncCall(\"employee lookup\")"))

  const sync = readFileSync(
    join(ROOT, "lib/auth/sync-employee-auth-metadata.ts"),
    "utf8"
  )
  assert.ok(sync.includes("addAuthSyncTimer(\"metadataUpdateMs\""))
  assert.ok(sync.includes("recordAuthSyncQuery(\"auth.updateUserById\""))
})

test("Sprint 29.0: proxy profiler logs breakdown + duplicate detection", () => {
  setAuthPerfEnabledForTests(true)
  const logs = []
  const originalInfo = console.info
  console.info = (...args) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    const session = beginProxyPerfSession("GET", "/atencion-cliente")
    assert.ok(session)
    setProxyTimer(session, "createClientMs", 2)
    setProxyTimer(session, "getUserMs", 120)
    setProxyTimer(session, "jwtValidationMs", 120)
    setProxyTimer(session, "loadMetadataMs", 1)
    setProxyTimer(session, "redirectLogicMs", 1)
    recordProxyCall(session, "getUser()")
    recordProxyCall(session, "getUser()")
    recordProxyQuery(session, "auth.getUser", 120)
    finishProxyPerfSession(session)

    const joined = logs.join("\n")
    assert.ok(joined.includes("[PROXY BREAKDOWN]"))
    assert.ok(joined.includes("GET /atencion-cliente"))
    assert.ok(joined.includes("[PROXY QUERY]"))
    assert.ok(joined.includes("auth.getUser"))
    assert.ok(joined.includes("[PROXY DUPLICATE]"))
    assert.ok(joined.includes("getUser()"))
    assert.ok(joined.includes("2 veces"))
  } finally {
    console.info = originalInfo
    setAuthPerfEnabledForTests(null)
  }
})

test("Sprint 29.0: auth sync profiler logs [AUTH SYNC]", async () => {
  setAuthPerfEnabledForTests(true)
  const logs = []
  const originalInfo = console.info
  console.info = (...args) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await runWithAuthSyncPerf(async () => {
      addAuthSyncTimer("userMs", 50)
      addAuthSyncTimer("employeeMs", 80)
      addAuthSyncTimer("roleMs", 40)
      addAuthSyncTimer("metadataUpdateMs", 90)
      recordAuthSyncCall("employee lookup")
      recordAuthSyncCall("employee lookup")
      recordAuthSyncQuery("employees", 80)
      recordAuthSyncQuery("employees", 70)
    })

    const joined = logs.join("\n")
    assert.ok(joined.includes("[AUTH SYNC]"))
    assert.ok(joined.includes("Metadata Update"))
    assert.ok(joined.includes("[AUTH SYNC QUERY]"))
    assert.ok(joined.includes("employees"))
    assert.ok(joined.includes("[AUTH SYNC DUPLICATE]"))
    assert.ok(joined.includes("employee lookup"))
  } finally {
    console.info = originalInfo
    setAuthPerfEnabledForTests(null)
  }
})
