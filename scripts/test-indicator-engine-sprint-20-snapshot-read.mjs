import assert from "node:assert/strict"
import test from "node:test"

import { buildExecutiveBrief } from "../lib/executive/build-executive-brief.ts"
import {
  canServeSnapshotOfficialBrief,
  clearIndicatorEngineFeatureFlagsOverride,
  clearSituationRoomDualReadState,
  getLastSituationRoomDualReadState,
  loadSituationRoomViaDualRead,
  resolveOfficialSituationRoomBrief,
  resolveVisibleEngineMode,
  setIndicatorEngineFeatureFlagsOverride,
  shouldRunDualReadSidePath,
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
]

function resetFlags() {
  clearIndicatorEngineFeatureFlagsOverride()
}

function frozenEvents() {
  return Object.freeze([...events])
}

test("Sprint 20: engineMode v1 — official V1, no side path", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({ engineMode: "v1" })

  assert.equal(resolveVisibleEngineMode(), "v1")
  assert.equal(shouldRunDualReadSidePath(), false)

  clearSituationRoomDualReadState()
  const frozen = frozenEvents()
  const result = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events: frozen,
  })
  const direct = buildExecutiveBrief({
    scope: { kind: "company", label: "Empresa" },
    date: DATE,
    events: frozen,
  })

  assert.equal(result.officialSource, "v1")
  assert.equal("dualRead" in result, false)
  assert.equal(result.brief.narrative, direct.narrative)
  assert.deepEqual(result.brief.snapshot.values, direct.snapshot.values)
  assert.equal(getLastSituationRoomDualReadState().runCount, 0)

  resetFlags()
})

test("Sprint 20: engineMode dual (default) — V1 official, Comparator side path", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "dual",
    comparatorEnabled: true,
    telemetryEnabled: false,
  })

  assert.equal(resolveVisibleEngineMode(), "v1")
  assert.equal(shouldRunDualReadSidePath(), true)

  clearSituationRoomDualReadState()
  const frozen = frozenEvents()
  const result = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events: frozen,
  })
  const direct = buildExecutiveBrief({
    scope: { kind: "company", label: "Empresa" },
    date: DATE,
    events: frozen,
  })

  assert.equal(result.officialSource, "v1")
  assert.ok(result.dualRead)
  assert.equal(result.dualRead.comparison.match, true)
  assert.ok(result.dualRead.comparison.coverage.comparedFields > 0)
  assert.equal(result.dualRead.fallbackReason, null)
  assert.equal(result.brief.narrative, direct.narrative)
  assert.deepEqual(result.brief.snapshot.values, direct.snapshot.values)

  resetFlags()
})

test("Sprint 20: engineMode v2 + Comparator match — Snapshot official path", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "v2",
    comparatorEnabled: true,
    telemetryEnabled: false,
  })

  assert.equal(resolveVisibleEngineMode(), "v2")

  clearSituationRoomDualReadState()
  const frozen = frozenEvents()
  const result = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events: frozen,
  })
  const direct = buildExecutiveBrief({
    scope: { kind: "company", label: "Empresa" },
    date: DATE,
    events: frozen,
  })

  assert.equal(result.officialSource, "v2")
  assert.ok(result.dualRead)
  assert.equal(result.dualRead.comparison.match, true)
  assert.equal(result.dualRead.fallbackReason, null)
  // Functional equality with V1 business fields (no visual drift).
  assert.equal(result.brief.narrative, direct.narrative)
  assert.deepEqual(result.brief.snapshot.values, direct.snapshot.values)
  assert.equal(result.brief.relevantActivity.length, direct.relevantActivity.length)
  assert.equal(getLastSituationRoomDualReadState().lastOfficialSource, "v2")

  resetFlags()
})

test("Sprint 20: engineMode v2 + Comparator inactive — automatic V1 fallback", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "v2",
    comparatorEnabled: false,
    telemetryEnabled: false,
  })

  clearSituationRoomDualReadState()
  const result = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events: frozenEvents(),
  })

  assert.equal(result.officialSource, "v1")
  assert.ok(result.dualRead)
  assert.equal(result.dualRead.comparison.coverage.comparedFields, 0)
  assert.equal(result.dualRead.fallbackReason, "comparator_no_coverage")
  assert.equal(getLastSituationRoomDualReadState().lastOfficialSource, "v1")

  resetFlags()
})

test("Sprint 20: resolveOfficialSituationRoomBrief fallback on mismatch", () => {
  const scope = { kind: "company", label: "Empresa" }
  const v1Brief = buildExecutiveBrief({
    scope,
    date: DATE,
    events,
  })

  const mismatch = {
    match: false,
    coverage: { comparedFields: 3, matchedFields: 1, ratio: 1 / 3 },
    differences: [{ path: "values.x", left: 1, right: 2 }],
    skipped: false,
  }

  const resolved = resolveOfficialSituationRoomBrief({
    engineMode: "v2",
    v1Brief,
    briefV2: {
      identity: {
        companyId: COMPANY_ID,
        date: DATE,
        scope: "company",
        subjectId: null,
        version: "1.0.0",
      },
      date: DATE,
      narrative: "SHOULD_NOT_SHOW",
      generalState: [],
      production: [],
      operationalAlerts: [],
      relevantActivity: [],
      snapshot: {
        identity: {
          companyId: COMPANY_ID,
          date: DATE,
          scope: "company",
          subjectId: null,
          version: "1.0.0",
        },
        payload: {
          indicators: { events_total: 99 },
          status: "ready",
          timestamps: {
            createdAt: DATE,
            updatedAt: DATE,
            calculatedAt: DATE,
          },
          metadata: {},
          version: "2.0.0",
          updateMode: "bootstrap",
        },
      },
      digest: { items: [] },
      firstEventAt: null,
      lastEventAt: null,
      activeTimeMs: 0,
    },
    comparison: /** @type {any} */ (mismatch),
    scope,
  })

  assert.equal(resolved.source, "v1")
  assert.equal(resolved.fallbackReason, "comparator_mismatch")
  assert.equal(resolved.brief.narrative, v1Brief.narrative)
  assert.notEqual(resolved.brief.narrative, "SHOULD_NOT_SHOW")
  assert.equal(canServeSnapshotOfficialBrief(/** @type {any} */ (mismatch)), false)
})

test("Sprint 20: no second event consumption (same frozen array)", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "v2",
    comparatorEnabled: true,
  })

  const frozen = frozenEvents()
  const before = frozen.length
  loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events: frozen,
  })
  assert.equal(frozen.length, before)
  assert.equal(Object.isFrozen(frozen), true)

  resetFlags()
})
