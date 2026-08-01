import assert from "node:assert/strict"
import test from "node:test"

import {
  clearShadowPipelineMetrics,
  DEMO_ACTIVITY_DATASET,
  DEMO_BUSINESS_DATE,
  getLastShadowPipelineMetrics,
  getShadowPipelineMetricsSummary,
  listShadowPipelineMetrics,
  observeShadowPipeline,
  runShadowPipeline,
} from "../lib/indicator-engine/index.ts"

const NOW = "2026-08-01T19:00:00.000Z"

function companyContext() {
  return {
    companyId: "11111111-1111-4111-8111-111111111111",
    date: DEMO_BUSINESS_DATE,
    scope: "company",
    subjectId: null,
    version: "1.0.0",
    catalogVersion: "2.0.0-sprint2",
    metadata: { test: "sprint-8" },
  }
}

test("Sprint 8 Shadow: processes in-memory events and discards business output", () => {
  clearShadowPipelineMetrics()

  const outcome = runShadowPipeline({
    events: DEMO_ACTIVITY_DATASET,
    context: companyContext(),
    now: NOW,
  })

  assert.equal(outcome.metrics.ok, true)
  assert.equal(outcome.metrics.discarded, true)
  assert.equal(outcome.metrics.eventCount, DEMO_ACTIVITY_DATASET.length)
  assert.ok(outcome.metrics.indicatorCount > 0)
  assert.ok(outcome.metrics.durationMs >= 0)
  assert.equal(outcome.metrics.scope, "company")

  // Outcome must not expose Snapshot / Digest / Brief
  assert.equal("snapshot" in outcome, false)
  assert.equal("digest" in outcome, false)
  assert.equal("brief" in outcome, false)
  assert.equal("result" in outcome, false)
})

test("Sprint 8 Shadow: empty collection is valid and recorded", () => {
  clearShadowPipelineMetrics()

  const outcome = runShadowPipeline({
    events: [],
    context: companyContext(),
    now: NOW,
  })

  assert.equal(outcome.metrics.ok, true)
  assert.equal(outcome.metrics.eventCount, 0)
  assert.equal(getLastShadowPipelineMetrics()?.eventCount, 0)
})

test("Sprint 8 Shadow: observe never throws; metrics stay in memory only", () => {
  clearShadowPipelineMetrics()

  assert.doesNotThrow(() => {
    observeShadowPipeline({
      events: DEMO_ACTIVITY_DATASET,
      context: companyContext(),
      now: NOW,
    })
  })

  const summary = getShadowPipelineMetricsSummary()
  assert.equal(summary.runCount, 1)
  assert.equal(summary.totalEventsProcessed, DEMO_ACTIVITY_DATASET.length)
  assert.ok(summary.last?.discarded)
  assert.equal(listShadowPipelineMetrics().length, 1)
})

test("Sprint 8 Shadow: accepts IE 1.x-shaped source events without AE imports", () => {
  clearShadowPipelineMetrics()

  const ie1xShaped = [
    {
      id: "ie1-1",
      module: "tasks",
      action: "workorder.finished",
      entityType: "task",
      entityId: "t-1",
      employeeId: "e-1",
      createdAt: "2026-08-01T12:00:00.000Z",
      metadata: { ignored_technical: true },
      title: "OT",
      description: null,
    },
  ]

  const outcome = runShadowPipeline({
    events: ie1xShaped,
    context: companyContext(),
    now: NOW,
  })

  assert.equal(outcome.metrics.ok, true)
  assert.equal(outcome.metrics.eventCount, 1)
})

test("Sprint 8 Shadow: invalid context is swallowed into failed metrics", () => {
  clearShadowPipelineMetrics()

  const outcome = runShadowPipeline({
    events: DEMO_ACTIVITY_DATASET,
    context: {
      ...companyContext(),
      scope: "employee",
      subjectId: null,
    },
    now: NOW,
  })

  assert.equal(outcome.metrics.ok, false)
  assert.equal(outcome.metrics.discarded, true)
  assert.ok(outcome.metrics.errorMessage)
})
