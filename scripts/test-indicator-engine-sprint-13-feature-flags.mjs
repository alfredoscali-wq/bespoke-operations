import assert from "node:assert/strict"
import test from "node:test"

import { buildExecutiveBrief } from "../lib/executive/build-executive-brief.ts"
import {
  buildComparisonReport,
  clearIndicatorEngineFeatureFlagsOverride,
  clearPerformanceReports,
  clearSituationRoomDualReadState,
  createIndicatorFacade,
  DEMO_ACTIVITY_DATASET,
  DEMO_BUSINESS_DATE,
  getIndicatorEngineFeatureFlags,
  getLastPerformanceReport,
  getLastSituationRoomDualReadState,
  isComparatorEnabled,
  isPerformanceTelemetryEnabled,
  isShadowPipelineEnabled,
  isTelemetryEnabled,
  listPerformanceReports,
  loadSituationRoomViaDualRead,
  resolveVisibleEngineMode,
  runShadowPipeline,
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

function companyContext() {
  return {
    companyId: COMPANY_ID,
    date: DEMO_BUSINESS_DATE,
    scope: "company",
    subjectId: null,
    version: "1.0.0",
    catalogVersion: "2.0.0-sprint2",
    metadata: {},
  }
}

function comparisonFixture() {
  const now = "2026-08-01T20:00:00.000Z"
  const values = { events_total: 1, tasks_finished: 1 }
  return {
    legacySnapshot: { values },
    nextSnapshot: {
      identity: {
        companyId: COMPANY_ID,
        date: DATE,
        scope: "company",
        subjectId: null,
        version: "1.0.0",
      },
      payload: {
        indicators: values,
        status: "ready",
        timestamps: {
          createdAt: now,
          updatedAt: now,
          calculatedAt: now,
        },
        metadata: {},
        version: "2.0.0",
        updateMode: "bootstrap",
      },
    },
    legacyDigest: {
      items: [
        {
          action: "workorder.finished",
          title: "OT",
          description: null,
          entityType: "task",
          entityId: "t1",
        },
      ],
    },
    nextDigest: {
      items: [
        {
          id: "d1",
          createdAt: now,
          action: "workorder.finished",
          title: "OT",
          description: null,
          entityType: "task",
          entityId: "t1",
          employeeId: "e1",
        },
      ],
    },
    legacyBrief: {
      date: DATE,
      narrative: "ok",
      generalState: [{ id: "g1", label: "G", value: 1, unit: null }],
      production: {
        title: "P",
        metrics: [{ id: "p1", label: "P", value: 1, unit: null }],
      },
      operationalAlerts: [],
      relevantActivity: [],
      firstEventAt: now,
      lastEventAt: now,
      activeTimeMs: 0,
    },
    nextBrief: {
      identity: {
        companyId: COMPANY_ID,
        date: DATE,
        scope: "company",
        subjectId: null,
        version: "1.0.0",
      },
      date: DATE,
      narrative: "ok",
      generalState: [{ id: "g1", label: "G", value: 1, unit: null }],
      production: {
        title: "P",
        metrics: [{ id: "p1", label: "P", value: 1, unit: null }],
      },
      operationalAlerts: [],
      relevantActivity: [],
      snapshot: null,
      digest: null,
      firstEventAt: now,
      lastEventAt: now,
      activeTimeMs: 0,
    },
    now,
  }
}

function resetFlags() {
  clearIndicatorEngineFeatureFlagsOverride()
}

test("Sprint 13: defaults are dual + shadow + comparator; telemetry = non-production", () => {
  resetFlags()
  const flags = getIndicatorEngineFeatureFlags()
  assert.equal(flags.engineMode, "dual")
  assert.equal(flags.shadowEnabled, true)
  assert.equal(flags.comparatorEnabled, true)
  assert.equal(flags.telemetryEnabled, process.env.NODE_ENV !== "production")
  assert.equal(resolveVisibleEngineMode(), "v1")
})

test("Sprint 13: mode v1 disables dual side path, shadow, and comparator", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({ engineMode: "v1" })

  assert.equal(getIndicatorEngineFeatureFlags().engineMode, "v1")
  assert.equal(shouldRunDualReadSidePath(), false)
  assert.equal(isShadowPipelineEnabled(), false)
  assert.equal(isComparatorEnabled(), false)
  assert.equal(resolveVisibleEngineMode(), "v1")

  clearSituationRoomDualReadState()
  const result = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events,
  })
  assert.equal("dualRead" in result, false)
  assert.equal(getLastSituationRoomDualReadState().runCount, 0)

  const shadow = runShadowPipeline({
    events: DEMO_ACTIVITY_DATASET,
    context: companyContext(),
  })
  assert.equal(shadow.metrics.skipped, true)
  assert.equal(shadow.metrics.ok, true)
  assert.equal(shadow.metrics.discarded, true)

  const report = buildComparisonReport(comparisonFixture())
  assert.equal(report.coverage.comparedFields, 0)
  assert.equal(report.match, true)

  resetFlags()
})

test("Sprint 13: mode dual enables side path; visible path remains V1", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "dual",
    shadowEnabled: true,
    comparatorEnabled: true,
    telemetryEnabled: true,
  })

  assert.equal(shouldRunDualReadSidePath(), true)
  assert.equal(isShadowPipelineEnabled(), true)
  assert.equal(isComparatorEnabled(), true)
  assert.equal(resolveVisibleEngineMode(), "v1")

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
  assert.deepEqual(viaDual.brief.snapshot.values, viaV1.snapshot.values)
  assert.ok(viaDual.dualRead)
  assert.equal(viaDual.dualRead.comparison.match, true)
  assert.equal(getLastSituationRoomDualReadState().runCount, 1)

  resetFlags()
})

test("Sprint 13: mode v2 enables Snapshot-eligible visible mode; dual side path still allowed", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "v2",
    shadowEnabled: true,
    comparatorEnabled: true,
    telemetryEnabled: false,
  })

  assert.equal(getIndicatorEngineFeatureFlags().engineMode, "v2")
  assert.equal(resolveVisibleEngineMode(), "v2")
  assert.equal(shouldRunDualReadSidePath(), true)

  const facade = createIndicatorFacade()
  assert.equal(facade.config.backend, "v2")

  clearSituationRoomDualReadState()
  const result = loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events,
  })

  assert.ok(result.brief)
  assert.equal("briefV2" in result, false)
  assert.equal("snapshotV2" in result, false)
  assert.ok(result.dualRead)
  // Sprint 20: with Comparator match, official source may be v2 (projected).
  assert.ok(
    result.officialSource === "v1" || result.officialSource === "v2"
  )

  resetFlags()
})

test("Sprint 13: shadow on/off", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "dual",
    shadowEnabled: true,
  })
  assert.equal(isShadowPipelineEnabled(), true)
  const on = runShadowPipeline({
    events: DEMO_ACTIVITY_DATASET,
    context: companyContext(),
  })
  assert.equal(on.metrics.skipped, undefined)
  assert.equal(on.metrics.ok, true)
  assert.ok(on.metrics.indicatorCount >= 0)

  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "dual",
    shadowEnabled: false,
  })
  assert.equal(isShadowPipelineEnabled(), false)
  const off = runShadowPipeline({
    events: DEMO_ACTIVITY_DATASET,
    context: companyContext(),
  })
  assert.equal(off.metrics.skipped, true)
  assert.equal(off.metrics.indicatorCount, 0)

  resetFlags()
})

test("Sprint 13: comparator on/off", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "dual",
    comparatorEnabled: true,
  })
  assert.equal(isComparatorEnabled(), true)
  const on = buildComparisonReport(comparisonFixture())
  assert.ok(on.coverage.comparedFields > 0)

  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "dual",
    comparatorEnabled: false,
  })
  assert.equal(isComparatorEnabled(), false)
  const off = buildComparisonReport(comparisonFixture())
  assert.equal(off.coverage.comparedFields, 0)
  assert.equal(off.match, true)

  resetFlags()
})

test("Sprint 13: telemetry on/off", () => {
  resetFlags()
  setIndicatorEngineFeatureFlagsOverride({ telemetryEnabled: true })
  assert.equal(isTelemetryEnabled(), true)
  assert.equal(isPerformanceTelemetryEnabled(), true)

  clearPerformanceReports()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "dual",
    comparatorEnabled: true,
    telemetryEnabled: true,
  })
  loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events,
  })
  assert.ok(getLastPerformanceReport())
  assert.ok(listPerformanceReports().length >= 1)

  clearPerformanceReports()
  setIndicatorEngineFeatureFlagsOverride({
    engineMode: "dual",
    comparatorEnabled: true,
    telemetryEnabled: false,
  })
  assert.equal(isTelemetryEnabled(), false)
  assert.equal(isPerformanceTelemetryEnabled(), false)

  loadSituationRoomViaDualRead({
    companyId: COMPANY_ID,
    date: DATE,
    events,
  })
  assert.equal(getLastPerformanceReport(), null)
  assert.equal(listPerformanceReports().length, 0)

  resetFlags()
})

test("Sprint 13: Sala brief identical under default dual flags", () => {
  resetFlags()
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
  assert.deepEqual(viaDual.brief.snapshot.values, viaV1.snapshot.values)
  assert.equal(viaDual.brief.narrative, viaV1.narrative)
})
