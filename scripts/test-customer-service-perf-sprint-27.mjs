import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  beginCustomerServiceInboxProfile,
  finishCustomerServiceInboxProfile,
  getLastCustomerServiceInboxMetrics,
  isCustomerServicePerfEnabled,
  measureCustomerServiceSourceQuery,
  recordCustomerServiceCustomerLookup,
  recordCustomerServiceRowsLoaded,
  recordCustomerServiceSeguimientoQuery,
  resetCustomerServicePerfForTests,
  setCustomerServicePerfEnabledForTests,
} from "../lib/customer-service/performance/index.ts"

const ROOT = process.cwd()

test("Sprint 27 ATC: profiler is development-gated", () => {
  setCustomerServicePerfEnabledForTests(null)
  const enabledSource = readFileSync(
    join(ROOT, "lib/customer-service/performance/enabled.ts"),
    "utf8"
  )
  assert.ok(enabledSource.includes('NODE_ENV === "development"'))
  assert.equal(typeof isCustomerServicePerfEnabled(), "boolean")
})

test("Sprint 27 ATC: session accumulates source / lookup / seguimiento metrics", async () => {
  resetCustomerServicePerfForTests()
  setCustomerServicePerfEnabledForTests(true)

  const session = beginCustomerServiceInboxProfile()
  assert.ok(session)

  await measureCustomerServiceSourceQuery(
    "activeResult",
    async () => ({ data: [{ id: "1" }, { id: "2" }] }),
    (result) => result.data.length,
    session
  )
  await measureCustomerServiceSourceQuery(
    "resolvedTodayResult",
    async () => ({ data: [{ id: "3" }] }),
    (result) => result.data.length,
    session
  )
  await measureCustomerServiceSourceQuery(
    "recentResolvedResult",
    async () => ({ data: [{ id: "4" }, { id: "5" }, { id: "6" }] }),
    (result) => result.data.length,
    session
  )

  recordCustomerServiceRowsLoaded(5, session)
  recordCustomerServiceCustomerLookup({
    customerIds: ["c1", "c2"],
    durationMs: 12,
    session,
  })
  recordCustomerServiceCustomerLookup({
    customerIds: ["c2", "c1"],
    durationMs: 8,
    session,
  })
  recordCustomerServiceSeguimientoQuery({
    label: "inbox.latest_management",
    atencionIds: ["a1"],
    durationMs: 20,
    rowCount: 4,
    session,
  })
  recordCustomerServiceSeguimientoQuery({
    label: "inbox.latest_management",
    atencionIds: ["a1"],
    durationMs: 18,
    rowCount: 4,
    session,
  })

  const metrics = finishCustomerServiceInboxProfile(session)
  assert.ok(metrics)
  assert.equal(metrics.activeRows, 2)
  assert.equal(metrics.resolvedTodayRows, 1)
  assert.equal(metrics.recentResolvedRows, 3)
  assert.equal(metrics.rowsLoaded, 5)
  assert.equal(metrics.customerLookups, 2)
  assert.equal(metrics.duplicateCustomerLookups, 1)
  assert.equal(metrics.seguimientoLookups, 2)
  assert.equal(metrics.duplicateSeguimientoQueries, 1)
  assert.equal(metrics.sourceQueries.length, 3)
  assert.equal(getLastCustomerServiceInboxMetrics()?.rowsLoaded, 5)

  setCustomerServicePerfEnabledForTests(null)
  resetCustomerServicePerfForTests()
})

test("Sprint 27 ATC: instrumentation wired without UX/business changes", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )
  assert.ok(provider.includes("beginCustomerServiceInboxProfile"))
  assert.ok(provider.includes("finishCustomerServiceInboxProfile"))

  const queries = readFileSync(
    join(ROOT, "lib/supabase/customer-atenciones.queries.ts"),
    "utf8"
  )
  assert.ok(queries.includes("measureCustomerServiceSourceQuery"))
  assert.ok(queries.includes('"activeResult"'))
  assert.ok(queries.includes('"resolvedTodayResult"'))
  assert.ok(queries.includes('"recentResolvedResult"'))
  assert.ok(queries.includes("recordCustomerServiceCustomerLookup"))
  assert.ok(queries.includes("recordCustomerServiceSeguimientoQuery"))

  const seguimientos = readFileSync(
    join(ROOT, "lib/supabase/customer-seguimientos.queries.ts"),
    "utf8"
  )
  assert.ok(seguimientos.includes("withCustomerServiceSeguimientoTiming"))
  assert.ok(seguimientos.includes("recordCustomerServiceCustomerLookup"))

  const summary = readFileSync(
    join(ROOT, "lib/customer-service/performance/profiler.ts"),
    "utf8"
  )
  assert.ok(summary.includes("[ATC Performance]"))
  assert.ok(summary.includes("Inbox Load:"))
  assert.ok(summary.includes("Customer Lookup:"))
  assert.ok(summary.includes("Seguimientos:"))
  assert.ok(summary.includes("Total Duration:"))
})
