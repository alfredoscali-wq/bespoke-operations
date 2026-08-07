/**
 * Sprint 31.0 — release-expired breakdown instrumentation wiring.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  addReleaseExpiredTimer,
  recordReleaseExpiredCall,
  recordReleaseExpiredQuery,
  runWithReleaseExpiredPerf,
} from "../lib/customer-service/performance/release-expired-breakdown.ts"
import { setCustomerServicePerfEnabledForTests } from "../lib/customer-service/performance/enabled.ts"

const ROOT = process.cwd()

test("Sprint 31.0: release-expired route wraps with runWithReleaseExpiredPerf", () => {
  const route = readFileSync(
    join(
      ROOT,
      "app/api/atencion-cliente/release-expired-managements/route.ts"
    ),
    "utf8"
  )
  assert.ok(route.includes("runWithReleaseExpiredPerf"))
  // Sprint 32.0 — auth via JWT metadata helper (still wrapped by Sprint 31 profiler).
  assert.ok(route.includes("requireReleaseExpiredAuthContext"))
  assert.ok(route.includes("releaseExpiredCustomerAtencionManagements"))
})

test("Sprint 31.0: server RPC records rpc + parse phases", () => {
  const server = readFileSync(
    join(ROOT, "lib/customer-atenciones/consultation-management.server.ts"),
    "utf8"
  )
  assert.ok(server.includes("addReleaseExpiredTimer(\"rpcMs\""))
  assert.ok(server.includes("recordReleaseExpiredQuery(\"rpc.release_expired\""))
  assert.ok(server.includes("addReleaseExpiredTimer(\"parseMs\""))
})

test("Sprint 31.0: session records employee/role into release-expired store", () => {
  const session = readFileSync(join(ROOT, "lib/auth/session.ts"), "utf8")
  assert.ok(session.includes("getReleaseExpiredStore"))
  assert.ok(session.includes("addReleaseExpiredTimer(\"employeeMs\""))
  assert.ok(session.includes("addReleaseExpiredTimer(\"roleMs\""))
  assert.ok(session.includes("addReleaseExpiredTimer(\"sessionUserMs\""))
  assert.ok(session.includes("recordReleaseExpiredQuery(\"employees\""))
  assert.ok(session.includes("recordReleaseExpiredQuery(\"company_roles\""))
})

test("Sprint 31.0: profiler emits RELEASE EXPIRED blocks", async () => {
  setCustomerServicePerfEnabledForTests(true)
  const logs = []
  const originalInfo = console.info
  console.info = (...args) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await runWithReleaseExpiredPerf(async () => {
      addReleaseExpiredTimer("sessionUserMs", 200)
      addReleaseExpiredTimer("employeeMs", 80)
      addReleaseExpiredTimer("roleMs", 40)
      addReleaseExpiredTimer("rpcMs", 120)
      addReleaseExpiredTimer("parseMs", 1)
      recordReleaseExpiredQuery("auth.getUser", 70)
      recordReleaseExpiredQuery("employees", 80)
      recordReleaseExpiredQuery("company_roles", 40)
      recordReleaseExpiredQuery("rpc.release_expired", 120)
      recordReleaseExpiredCall("employee lookup")
    })

    const joined = logs.join("\n")
    assert.ok(joined.includes("[ATC RELEASE EXPIRED]"))
    assert.ok(joined.includes("Session User"))
    assert.ok(joined.includes("RPC"))
    assert.ok(joined.includes("[ATC RELEASE EXPIRED QUERY]"))
    assert.ok(joined.includes("rpc.release_expired"))
    assert.ok(joined.includes("[ATC RELEASE EXPIRED DUPLICATE]"))
    assert.ok(joined.includes("(none)"))
  } finally {
    console.info = originalInfo
    setCustomerServicePerfEnabledForTests(null)
  }
})
