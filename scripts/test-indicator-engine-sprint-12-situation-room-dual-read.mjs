import assert from "node:assert/strict"
import test from "node:test"

import { buildExecutiveBrief } from "../lib/executive/build-executive-brief.ts"
import {
  clearPerformanceReports,
  clearSituationRoomDualReadState,
  getLastPerformanceReport,
  getLastSituationRoomDualReadState,
  isPerformanceTelemetryEnabled,
  listPerformanceReports,
  loadSituationRoomViaDualRead,
} from "../lib/indicator-engine/index.ts"

const COMPANY_ID = "11111111-1111-4111-8111-111111111111"
const DATE = "2026-08-01"

const events = [
  {
    id: "1",
    module: "tasks",
    action: "workorder.finished",
    entityType: "task",
    entityId: "t1",
    employeeId: "e1",
    createdAt: "2026-08-01T12:00:00.000Z",
    title: "OT finalizada",
    description: null,
    metadata: {},
  },
  {
    id: "2",
    module: "commercial",
    action: "commercial_activity.completed",
    entityType: "sales_opportunity",
    entityId: "o1",
    employeeId: "e1",
    createdAt: "2026-08-01T13:00:00.000Z",
    title: "Venta",
    description: null,
    metadata: {},
  },
]

test("Sprint 12 Dual Read: returns V1 brief identical to direct V1 builder", () => {
  clearSituationRoomDualReadState()
  clearPerformanceReports()

  const viaDual = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events,
  })

  const viaV1 = buildExecutiveBrief({
    scope: { kind: "company", label: "Empresa" },
    date: DATE,
    events,
  })

  assert.equal(viaDual.brief.narrative, viaV1.narrative)
  assert.deepEqual(viaDual.brief.generalState, viaV1.generalState)
  assert.deepEqual(viaDual.brief.production, viaV1.production)
  assert.deepEqual(viaDual.brief.snapshot.values, viaV1.snapshot.values)
  assert.deepEqual(viaDual.brief.relevantActivity, viaV1.relevantActivity)
})

test("Sprint 12 Dual Read: does not expose V2 artifacts on the result root", () => {
  const result = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events,
  })

  assert.equal("snapshotV2" in result, false)
  assert.equal("briefV2" in result, false)
  assert.ok(result.brief)
  // dualRead side-channel may exist in development only
  if (isPerformanceTelemetryEnabled()) {
    assert.ok(result.dualRead)
    assert.equal(result.dualRead.comparison.match, true)
  }
})

test("Sprint 12 Dual Read: Comparator reports equivalence in development", () => {
  if (!isPerformanceTelemetryEnabled()) return

  clearSituationRoomDualReadState()
  loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events,
  })

  const state = getLastSituationRoomDualReadState()
  assert.equal(state.runCount, 1)
  assert.ok(state.lastComparison)
  assert.equal(state.lastComparison.match, true)
  assert.equal(state.lastComparison.coverage.ratio, 1)
  assert.ok(state.lastV1DurationMs >= 0)
  assert.ok(state.lastV2DurationMs >= 0)
})

test("Sprint 12 Dual Read: Telemetry records V1/V2 timings without extra fetches", () => {
  if (!isPerformanceTelemetryEnabled()) return

  clearPerformanceReports()
  clearSituationRoomDualReadState()

  // Caller supplies events — Dual Read never fetches.
  const supplied = Object.freeze([...events])
  loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events: supplied,
  })

  const dualReports = listPerformanceReports().filter(
    (report) => report.source === "dual_read"
  )
  assert.ok(dualReports.length >= 1)
  const last = dualReports[dualReports.length - 1]
  assert.equal(last.eventCount, events.length)
  assert.ok(typeof last.metadata.v1DurationMs === "number")
  assert.ok(typeof last.metadata.v2DurationMs === "number")
  assert.equal(last.metadata.comparatorMatch, true)
  assert.ok(last.stageDurationsMs.dual_read_v1 >= 0)
  assert.ok(last.stageDurationsMs.dual_read_v2 >= 0)

  // Sanity: last report exists in store
  assert.ok(getLastPerformanceReport())
})

test("Sprint 12 Dual Read: empty events still returns V1-shaped brief", () => {
  const result = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events: [],
  })

  assert.equal(result.brief.date, DATE)
  assert.equal(result.brief.snapshot.values.events_total, 0)

  if (isPerformanceTelemetryEnabled()) {
    assert.equal(result.dualRead?.comparison.match, true)
  }
})
