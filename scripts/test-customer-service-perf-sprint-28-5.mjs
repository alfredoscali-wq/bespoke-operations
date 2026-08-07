/**
 * Sprint 28.5 — ATC mutation response breakdown instrumentation.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  beginAtcBreakdown,
  finalizeAtcBreakdown,
  getLastAtcBreakdownSnapshot,
  measureAtcBreakdownPhase,
  recordAtcBreakdownPhase,
  resetAtcBreakdownForTests,
} from "../lib/customer-service/performance/breakdown.ts"
import { setCustomerServicePerfEnabledForTests } from "../lib/customer-service/performance/enabled.ts"

const ROOT = process.cwd()

test("Sprint 28.5: breakdown module logs [ATC Breakdown] phases", async () => {
  setCustomerServicePerfEnabledForTests(true)
  resetAtcBreakdownForTests()

  // jsdom/window may be absent in node test — enable via fake window for finalize paint.
  const previousWindow = globalThis.window
  globalThis.window = {
    ...previousWindow,
    requestAnimationFrame: (cb) => {
      cb(0)
      return 0
    },
  }

  try {
    beginAtcBreakdown("start-management")
    await measureAtcBreakdownPhase("rpc", async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    recordAtcBreakdownPhase("refreshInbox", 40)
    recordAtcBreakdownPhase("loadDetail", 25)
    recordAtcBreakdownPhase("fetchAtencion", 10)
    recordAtcBreakdownPhase("fetchEvents", 12)
    await finalizeAtcBreakdown()

    const snapshot = getLastAtcBreakdownSnapshot()
    assert.ok(snapshot)
    assert.equal(snapshot.action, "start-management")
    assert.ok((snapshot.rpcMs ?? 0) >= 5)
    assert.equal(snapshot.refreshInboxMs, 40)
    assert.equal(snapshot.loadDetailMs, 25)
    assert.equal(snapshot.fetchAtencionMs, 10)
    assert.equal(snapshot.fetchEventsMs, 12)
    assert.ok((snapshot.totalMs ?? 0) >= 5)
  } finally {
    globalThis.window = previousWindow
    resetAtcBreakdownForTests()
    setCustomerServicePerfEnabledForTests(null)
  }
})

test("Sprint 28.5: start/defer/resolve wire breakdown; cancel does not", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )
  assert.ok(provider.includes('beginAtcBreakdown(breakdownAction)'))
  assert.ok(provider.includes('"start-management"'))
  assert.ok(provider.includes('"resolve"'))
  assert.ok(provider.includes('"defer"'))
  assert.ok(provider.includes('measureAtcBreakdownPhase("rpc"'))
  assert.ok(provider.includes('measureAtcBreakdownPhase("refreshInbox"'))

  const cancelBlock = provider.slice(
    provider.indexOf("const cancelConsultationManagementHandler"),
    provider.indexOf("const touchConsultationManagementActivityHandler")
  )
  assert.equal(cancelBlock.includes("start-management"), false)
  assert.equal(cancelBlock.includes("beginAtcBreakdown"), false)

  const detail = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-detail-screen.tsx"),
    "utf8"
  )
  assert.ok(detail.includes("finalizeAtcBreakdown"))
  assert.ok(detail.includes('"fetchAtencion"'))
  assert.ok(detail.includes('"fetchEvents"'))
  assert.ok(detail.includes("recordAtcBreakdownPhase(\"loadDetail\""))
})
