/**
 * Sprint 28.2 — ATC fast refresh (mutations skip KPI/dashboard bundle).
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

test("Sprint 28.2: refreshSharedInbox defaults to fast mode", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )

  assert.ok(provider.includes('options?.mode ?? "fast"'))
  assert.ok(provider.includes('mode === "fast"'))
  assert.ok(provider.includes("[ATC FastRefresh]"))
  assert.ok(provider.includes("skip releaseExpired + dashboard bundle"))
  assert.ok(provider.includes('reason: isFast ? "loadSharedInbox:fast"'))
})

test("Sprint 28.2: full path still loads bundle + releaseExpired", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )

  assert.ok(provider.includes("loadSharedInboxBundle"))
  assert.ok(provider.includes("releaseExpiredConsultationManagements"))
  assert.ok(provider.includes("shouldLoadDashboard"))
  // Mutations call refreshSharedInbox() without forcing full.
  const mutationBlock = provider.slice(
    provider.indexOf("const runConsultationManagementMutation"),
    provider.indexOf("const startConsultationManagementHandler")
  )
  assert.ok(mutationBlock.includes("refreshSharedInbox()"))
  assert.equal(mutationBlock.includes('mode: "full"'), false)
})

test("Sprint 28.2: list consultations expose operationalCounts from discovery", () => {
  const queries = readFileSync(
    join(ROOT, "lib/supabase/customer-atenciones.queries.ts"),
    "utf8"
  )
  assert.ok(queries.includes("operationalCounts: SharedInboxOperationalCounts"))
  assert.ok(
    queries.includes(
      "operationalCounts: computeOperationalWorkCounts(discoveryRows)"
    )
  )
})
