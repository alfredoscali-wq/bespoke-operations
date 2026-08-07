/**
 * Sprint 39.0 — Eliminate events.latest post-RPC lookup on defer/resolve.
 * event_id is returned by the RPC; attachments/activity keep the same payload.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import {
  addAtcActionTimer,
  recordAtcActionQuery,
  runWithAtcActionPerf,
} from "../lib/customer-service/performance/action-breakdown.ts"
import { setCustomerServicePerfEnabledForTests } from "../lib/customer-service/performance/enabled.ts"

const ROOT = process.cwd()
const SERVER =
  "lib/customer-atenciones/consultation-management.server.ts"
const MIGRATION =
  "supabase/migrations/20261120000100_customer_atenciones_defer_resolve_return_event_id.sql"
const BREAKDOWN =
  "lib/customer-service/performance/action-breakdown.ts"

test("Sprint 39.0: migration returns event_id from defer + resolve RPCs", () => {
  assert.equal(existsSync(join(ROOT, MIGRATION)), true)
  const sql = readFileSync(join(ROOT, MIGRATION), "utf8")
  assert.ok(sql.includes("RETURNING id INTO v_event_id"))
  assert.ok(sql.includes("'event_id', v_event_id"))
  assert.ok(sql.includes("resolve_customer_atencion_consultation"))
  assert.ok(sql.includes("defer_customer_atencion_consultation"))
})

test("Sprint 39.0: defer/resolve prefer RPC eventId and record Latest Event 0 ms", () => {
  const server = readFileSync(join(ROOT, SERVER), "utf8")
  assert.ok(server.includes("recordLatestEventEliminated"))
  assert.ok(server.includes("Sprint 39.0"))

  // Happy path: no unconditional resolveLatest on defer/resolve after RPC.
  assert.ok(
    /resolveCustomerAtencionConsultation[\s\S]*?if \(result\.data\.eventId\) \{\s*recordLatestEventEliminated\(\)/.test(
      server
    )
  )
  assert.ok(
    /deferCustomerAtencionConsultation[\s\S]*?if \(result\.data\.eventId\) \{\s*recordLatestEventEliminated\(\)/.test(
      server
    )
  )

  assert.ok(server.includes('recordAtcActionQuery("events.latest", 0'))
  assert.ok(server.includes('addAtcActionTimer("latestEventMs", 0)'))
})

test("Sprint 39.0: profiler logs Latest Event line", () => {
  const breakdown = readFileSync(join(ROOT, BREAKDOWN), "utf8")
  assert.ok(breakdown.includes("latestEventMs"))
  assert.ok(breakdown.includes('"Latest Event"'))
})

test("Sprint 39.0: Latest Event timer renders 0 ms in ATC ACTION log", async () => {
  setCustomerServicePerfEnabledForTests(true)
  const logs = []
  const originalInfo = console.info
  console.info = (...args) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await runWithAtcActionPerf("defer", async () => {
      addAtcActionTimer("latestEventMs", 0)
      recordAtcActionQuery("events.latest", 0, { cached: true })
      addAtcActionTimer("rpcMs", 100)
      addAtcActionTimer("authMs", 5)
    })
    await runWithAtcActionPerf("resolve", async () => {
      addAtcActionTimer("latestEventMs", 0)
      recordAtcActionQuery("events.latest", 0, { cached: true })
      addAtcActionTimer("rpcMs", 100)
      addAtcActionTimer("authMs", 5)
    })

    const joined = logs.join("\n")
    assert.ok(joined.includes("[ATC ACTION]"))
    assert.ok(/Latest Event\.+ 0 ms/.test(joined))
    assert.ok(joined.includes("events.latest"))
    assert.ok(joined.includes("(cache)"))
    assert.ok(joined.includes("defer"))
    assert.ok(joined.includes("resolve"))
  } finally {
    console.info = originalInfo
    setCustomerServicePerfEnabledForTests(null)
  }
})
