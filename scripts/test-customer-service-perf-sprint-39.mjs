/**
 * Sprint 39.0 — Activity Engine fire-and-forget on ATC management actions.
 * Sprint 42.0 superseded the helper with activity-queue enqueue/process;
 * keep the non-blocking contract assertions.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

test("Sprint 39.0/42.0: management activity emit is non-blocking (queued)", () => {
  const server = readFileSync(
    join(ROOT, "lib/customer-atenciones/consultation-management.server.ts"),
    "utf8"
  )

  assert.ok(server.includes("enqueueManagementActivities"))
  assert.ok(server.includes("activity-queue"))
  assert.equal(
    /await enqueueManagementActivities\(/.test(server),
    false
  )
  // Persist only inside the queued job — never on the request await chain.
  assert.ok(
    /run:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?await emitCustomerManagementActivities\(/.test(
      server
    )
  )

  assert.ok(
    /enqueueManagementActivities\(\{[\s\S]*?kind: "start"/.test(server)
  )
  assert.ok(
    /enqueueManagementActivities\(\{[\s\S]*?kind: "resolve"/.test(server)
  )
  assert.ok(
    /enqueueManagementActivities\(\{[\s\S]*?kind: "defer"/.test(server)
  )
})

test("Sprint 39.0/42.0: profiler still records activity as non-blocking (0 ms)", () => {
  const server = readFileSync(
    join(ROOT, "lib/customer-atenciones/consultation-management.server.ts"),
    "utf8"
  )
  assert.ok(server.includes('recordAtcActionQuery("activity", 0)'))
  assert.ok(server.includes('recordAtcActionCall("activity.emit")'))
})
