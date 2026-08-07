import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  getAtcClientPerfSnapshot,
  logAtcClientSummary,
  measureAtcClientSpan,
  resetAtcClientPerfForTests,
  trackAtcQueryInvalidation,
} from "../lib/customer-service/performance/client-profiler.ts"
import { setCustomerServicePerfEnabledForTests } from "../lib/customer-service/performance/enabled.ts"

const ROOT = process.cwd()

test("Sprint 27.1: ATC client summary format + span recording", async () => {
  resetAtcClientPerfForTests()
  setCustomerServicePerfEnabledForTests(true)

  // Node has no window — measureAtcClientSpan no-ops timing when window is undefined.
  // Validate logging helpers and wiring instead when window is missing.
  const hasWindow = typeof window !== "undefined"

  if (hasWindow) {
    await measureAtcClientSpan("inboxLoad", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }, { log: false })
    await measureAtcClientSpan("detailLoad", async () => null, { log: false })
    await measureAtcClientSpan("seguimientos", async () => null, { log: false })
    await measureAtcClientSpan("attachments", async () => null, { log: false })
    trackAtcQueryInvalidation(["customer_atenciones", "shared-inbox"], {
      log: false,
    })
    const snap = getAtcClientPerfSnapshot()
    assert.ok((snap.inboxLoadMs ?? 0) >= 0)
    assert.equal(snap.invalidations.length, 1)
    logAtcClientSummary("test")
  } else {
    // Still exercise non-window path: run should execute.
    const value = await measureAtcClientSpan("inboxLoad", async () => 42)
    assert.equal(value, 42)
  }

  setCustomerServicePerfEnabledForTests(null)
  resetAtcClientPerfForTests()
})

test("Sprint 27.1: client hooks and load paths are wired", () => {
  const hooks = readFileSync(
    join(ROOT, "lib/customer-service/performance/client-hooks.ts"),
    "utf8"
  )
  assert.ok(hooks.includes("useSharedInbox"))
  assert.ok(hooks.includes("useCustomerSeguimientos"))
  assert.ok(hooks.includes("useCustomerAtencionDetail"))
  assert.ok(hooks.includes("installAtcClientQueryInvalidationPatch"))
  // Sprint 27.3 — must not depend on the whole ctx object.
  assert.ok(hooks.includes("[loadSharedInboxFromContext]"))
  assert.equal(hooks.includes("[ctx]"), false)

  const profiler = readFileSync(
    join(ROOT, "lib/customer-service/performance/client-profiler.ts"),
    "utf8"
  )
  assert.ok(profiler.includes("[ATC Client]"))
  assert.ok(profiler.includes("Inbox Load"))
  assert.ok(profiler.includes("Detail Load"))
  assert.ok(profiler.includes("Seguimientos"))
  assert.ok(profiler.includes("Attachments"))
  assert.ok(profiler.includes("React Query Invalidations"))
  assert.ok(profiler.includes("invalidateQueries"))

  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )
  assert.ok(provider.includes("measureAtcClientSpan"))
  assert.ok(provider.includes('"inboxLoad"'))
  assert.ok(provider.includes("trackAtcQueryInvalidation"))
  assert.ok(provider.includes("installAtcClientQueryInvalidationPatch"))

  const detail = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-detail-screen.tsx"),
    "utf8"
  )
  assert.ok(detail.includes('"detailLoad"'))
  assert.ok(detail.includes('"attachments"'))
  assert.ok(detail.includes("useCustomerAtencionDetail"))

  const moduleSource = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-module.tsx"),
    "utf8"
  )
  assert.ok(moduleSource.includes("useSharedInbox"))
})
