import assert from "node:assert/strict"
import test from "node:test"

import {
  BUSINESS_INDICATOR_IDS,
  createInMemoryActivityProvider,
  DEMO_ACTIVITY_DATASET,
  DEMO_BUSINESS_DATE,
  DEMO_EMPLOYEE_A_ID,
  emptyInMemoryActivityProvider,
  inMemoryActivityProvider,
  runInMemoryPipeline,
  validateActivityInput,
  validateBusinessDigest,
  validateBusinessSnapshot,
  validateExecutiveBrief,
  validatePipelineResult,
} from "../lib/indicator-engine/index.ts"

const NOW = "2026-08-01T18:00:00.000Z"

function companyContext() {
  return {
    companyId: "11111111-1111-4111-8111-111111111111",
    date: DEMO_BUSINESS_DATE,
    scope: "company",
    subjectId: null,
    version: "1.0.0",
    catalogVersion: "2.0.0-sprint2",
    metadata: { test: "sprint-7" },
  }
}

function employeeContext(employeeId = DEMO_EMPLOYEE_A_ID) {
  return {
    ...companyContext(),
    scope: "employee",
    subjectId: employeeId,
  }
}

test("Sprint 7 E2E: empty dataset yields valid empty structural result", () => {
  const { activityInput, result } = runInMemoryPipeline({
    context: companyContext(),
    provider: emptyInMemoryActivityProvider,
    now: NOW,
  })

  assert.equal(validateActivityInput(activityInput).length, 0)
  assert.equal(activityInput.events.length, 0)
  assert.equal(validatePipelineResult(result).length, 0)
  assert.equal(validateBusinessSnapshot(result.snapshot).length, 0)
  assert.equal(validateBusinessDigest(result.digest).length, 0)
  assert.equal(validateExecutiveBrief(result.brief).length, 0)
  assert.equal(result.snapshot.payload.indicators.events_total, 0)
})

test("Sprint 7 E2E: single event", () => {
  const provider = createInMemoryActivityProvider([DEMO_ACTIVITY_DATASET[0]])
  const { activityInput, result } = runInMemoryPipeline({
    context: companyContext(),
    provider,
    now: NOW,
  })

  assert.equal(activityInput.events.length, 1)
  assert.equal(result.snapshot.payload.indicators.events_total, 1)
  assert.equal(result.digest.items.length, 1)
  assert.equal(validatePipelineResult(result).length, 0)
})

test("Sprint 7 E2E: multiple events across modules (company scope)", () => {
  const { activityInput, normalized, result } = runInMemoryPipeline({
    context: companyContext(),
    provider: inMemoryActivityProvider,
    now: NOW,
  })

  assert.equal(activityInput.events.length, DEMO_ACTIVITY_DATASET.length)
  assert.equal(normalized.facts.length, activityInput.events.length)

  const modules = new Set(activityInput.events.map((e) => e.module))
  assert.ok(modules.has("atencion"))
  assert.ok(modules.has("tasks"))
  assert.ok(modules.has("customers"))
  assert.ok(modules.has("commercial"))

  assert.equal(
    result.snapshot.payload.indicators[BUSINESS_INDICATOR_IDS.ATTENTIONS_CREATED],
    2
  )
  assert.equal(
    result.snapshot.payload.indicators[BUSINESS_INDICATOR_IDS.ATTENTIONS_RESOLVED],
    1
  )
  assert.equal(
    result.snapshot.payload.indicators[BUSINESS_INDICATOR_IDS.WORKORDERS_FINISHED],
    1
  )
  assert.equal(
    result.snapshot.payload.indicators[BUSINESS_INDICATOR_IDS.CUSTOMERS_CREATED],
    1
  )
  assert.equal(
    result.snapshot.payload.indicators[BUSINESS_INDICATOR_IDS.COMMERCIAL_COMPLETED],
    1
  )
  assert.equal(
    result.snapshot.payload.indicators[BUSINESS_INDICATOR_IDS.RETENTIONS],
    1
  )

  assert.equal(result.brief.identity.scope, "company")
  assert.equal(result.metadata.runner, "in-memory-pipeline")
  assert.equal(validatePipelineResult(result).length, 0)
})

test("Sprint 7 E2E: employee scope filters to subject events", () => {
  const { activityInput, result } = runInMemoryPipeline({
    context: employeeContext(DEMO_EMPLOYEE_A_ID),
    provider: inMemoryActivityProvider,
    now: NOW,
  })

  assert.ok(activityInput.events.length > 0)
  assert.ok(
    activityInput.events.every((event) => event.employeeId === DEMO_EMPLOYEE_A_ID)
  )
  assert.equal(result.brief.identity.scope, "employee")
  assert.equal(result.brief.identity.subjectId, DEMO_EMPLOYEE_A_ID)
  assert.equal(validateExecutiveBrief(result.brief).length, 0)
})

test("Sprint 7 E2E: adapter strips technical fields before pipeline", () => {
  const { activityInput } = runInMemoryPipeline({
    context: companyContext(),
    provider: inMemoryActivityProvider,
    now: NOW,
  })

  for (const event of activityInput.events) {
    assert.equal("severity" in event, false)
    assert.equal("origin" in event, false)
    assert.equal("sessionId" in event, false)
    assert.equal(event.metadata.rpc_debug, undefined)
  }

  const retention = activityInput.events.find(
    (event) => event.action === "NEXT_STEP_CHANGED"
  )
  assert.ok(retention)
  assert.equal(retention.module, "atencion")
  assert.equal(retention.metadata.new_next_step, "realizar_retencion")
})
