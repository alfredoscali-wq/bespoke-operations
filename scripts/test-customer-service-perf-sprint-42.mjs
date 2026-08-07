/**
 * Sprint 42.0 — Activity Queue decouples Activity Engine from ATC request path.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  enqueue,
  getActivityQueueDepthForTests,
  isActivityQueueProcessingForTests,
  process as processActivityQueue,
  resetActivityQueueForTests,
} from "../lib/activity/activity-queue.ts"

const ROOT = process.cwd()
const SERVER =
  "lib/customer-atenciones/consultation-management.server.ts"
const QUEUE = "lib/activity/activity-queue.ts"

test("Sprint 42.0: activity-queue exports enqueue + process", () => {
  const source = readFileSync(join(ROOT, QUEUE), "utf8")
  assert.ok(source.includes("export function enqueue"))
  assert.ok(source.includes("export async function process"))
  assert.ok(source.includes("Sprint 42.0"))
  assert.ok(source.includes("[ACTIVITY QUEUE]"))
})

test("Sprint 42.0: ATC management actions enqueue then return (no await emit)", () => {
  const server = readFileSync(join(ROOT, SERVER), "utf8")

  assert.ok(server.includes("enqueueManagementActivities"))
  assert.ok(server.includes('from "@/lib/activity/activity-queue"'))
  assert.ok(server.includes("Sprint 42.0"))

  assert.equal(server.includes("emitManagementActivitiesFireAndForget"), false)
  assert.equal(
    /await enqueueManagementActivities\(/.test(server),
    false
  )
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

  // Interaction + OT also go through the queue.
  assert.ok(server.includes('name: "atc.interaction"'))
  assert.ok(server.includes('name: "atc.ot-linked"'))
})

test("Sprint 42.0: profiler still records activity as non-blocking (0 ms)", () => {
  const server = readFileSync(join(ROOT, SERVER), "utf8")
  assert.ok(server.includes('recordAtcActionQuery("activity", 0)'))
  assert.ok(server.includes('recordAtcActionCall("activity.emit")'))
})

test("Sprint 42.0: enqueue is sync; process drains jobs and isolates failures", async () => {
  resetActivityQueueForTests()

  const order = []
  enqueue({
    name: "test.ok",
    run: async () => {
      order.push("ok")
    },
  })
  enqueue({
    name: "test.fail",
    run: async () => {
      order.push("fail-start")
      throw new Error("boom")
    },
  })
  enqueue({
    name: "test.after-fail",
    run: async () => {
      order.push("after-fail")
    },
  })

  // enqueue() already kicked process() — wait for the background drain.
  for (let i = 0; i < 50; i += 1) {
    if (
      !isActivityQueueProcessingForTests() &&
      getActivityQueueDepthForTests() === 0
    ) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  await processActivityQueue()

  assert.deepEqual(order, ["ok", "fail-start", "after-fail"])
  assert.equal(getActivityQueueDepthForTests(), 0)
  assert.equal(isActivityQueueProcessingForTests(), false)

  resetActivityQueueForTests()
})
