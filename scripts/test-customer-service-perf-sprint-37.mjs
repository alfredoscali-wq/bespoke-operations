/**
 * Sprint 37.0 — ATC ACTION breakdown for start/touch/defer/resolve.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  addAtcActionTimer,
  recordAtcActionCall,
  recordAtcActionQuery,
  runWithAtcActionPerf,
} from "../lib/customer-service/performance/action-breakdown.ts"
import { setCustomerServicePerfEnabledForTests } from "../lib/customer-service/performance/enabled.ts"

const ROOT = process.cwd()

const ROUTES = [
  "app/api/atencion-cliente/[atencionId]/start-management/route.ts",
  "app/api/atencion-cliente/[atencionId]/touch-management/route.ts",
  "app/api/atencion-cliente/[atencionId]/defer/route.ts",
  "app/api/atencion-cliente/[atencionId]/resolve/route.ts",
]

test("Sprint 37.0: action routes wrap with runWithAtcActionPerf", () => {
  for (const relative of ROUTES) {
    const source = readFileSync(join(ROOT, relative), "utf8")
    assert.ok(
      source.includes("runWithAtcActionPerf"),
      `${relative} missing runWithAtcActionPerf`
    )
    assert.ok(
      source.includes("measureAtcActionPhase(\"authMs\""),
      `${relative} missing auth phase`
    )
    assert.ok(
      source.includes("measureAtcActionPhase(\"responseBuildMs\""),
      `${relative} missing responseBuild phase`
    )
  }
})

test("Sprint 37.0: server RPC/event/activity instrumentation hooks exist", () => {
  const server = readFileSync(
    join(ROOT, "lib/customer-atenciones/consultation-management.server.ts"),
    "utf8"
  )
  assert.ok(server.includes("recordAtcActionQuery(\"rpc\""))
  assert.ok(server.includes("addAtcActionTimer(\"rpcMs\""))
  assert.ok(server.includes("recordAtcActionQuery(\"events.latest\""))
  // Sprint 42 — activity via queue; Sprint 39 FAF helper removed.
  assert.ok(
    server.includes("enqueueManagementActivities") ||
      server.includes("emitManagementActivitiesFireAndForget")
  )
  assert.ok(server.includes("recordAtcActionQuery(\"activity\""))
  assert.equal(
    /await enqueueManagementActivities\(/.test(server),
    false
  )
  assert.equal(
    /await emitManagementActivitiesFireAndForget\(/.test(server),
    false
  )
})

test("Sprint 37.0: session records auth queries into ATC ACTION store", () => {
  const session = readFileSync(join(ROOT, "lib/auth/session.ts"), "utf8")
  assert.ok(session.includes("getAtcActionStore"))
  assert.ok(session.includes("recordAtcActionQuery(\"auth.getUser\""))
  assert.ok(session.includes("recordAtcActionQuery(\"employees\""))
  assert.ok(session.includes("recordAtcActionQuery(\"company_roles\""))
})

test("Sprint 37.0: profiler emits ACTION / QUERY / DUPLICATE blocks", async () => {
  setCustomerServicePerfEnabledForTests(true)
  const logs = []
  const originalInfo = console.info
  console.info = (...args) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await runWithAtcActionPerf("start-management", async () => {
      addAtcActionTimer("authMs", 220)
      addAtcActionTimer("rpcMs", 95)
      addAtcActionTimer("transformMs", 40)
      addAtcActionTimer("responseBuildMs", 2)
      recordAtcActionQuery("auth.getUser", 5, { cached: true })
      recordAtcActionQuery("employees", 120)
      recordAtcActionQuery("company_roles", 90)
      recordAtcActionQuery("rpc", 95)
      recordAtcActionQuery("activity", 35)
      recordAtcActionCall("getUser()")
      recordAtcActionCall("employee lookup")
    })

    const joined = logs.join("\n")
    assert.ok(joined.includes("[ATC ACTION]"))
    assert.ok(joined.includes("Auth"))
    assert.ok(joined.includes("RPC"))
    assert.ok(joined.includes("Transform"))
    assert.ok(joined.includes("Revalidate"))
    assert.ok(joined.includes("Response Build"))
    assert.ok(joined.includes("[ATC ACTION QUERY]"))
    assert.ok(joined.includes("auth.getUser"))
    assert.ok(joined.includes("(cache)"))
    assert.ok(joined.includes("rpc"))
    assert.ok(joined.includes("activity"))
    assert.ok(joined.includes("[ATC ACTION DUPLICATE]"))
    assert.ok(joined.includes("(none)"))
  } finally {
    console.info = originalInfo
    setCustomerServicePerfEnabledForTests(null)
  }
})
