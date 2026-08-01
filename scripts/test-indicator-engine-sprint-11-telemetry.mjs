import assert from "node:assert/strict"
import test from "node:test"

import {
  buildComparisonReport,
  clearPerformanceReports,
  DEMO_ACTIVITY_DATASET,
  DEMO_BUSINESS_DATE,
  getLastPerformanceReport,
  getPerformanceTelemetrySummary,
  indicatorFacade,
  isPerformanceTelemetryEnabled,
  listPerformanceReports,
  runShadowPipeline,
  startPerformanceTelemetry,
} from "../lib/indicator-engine/index.ts"

function companyContext() {
  return {
    companyId: "11111111-1111-4111-8111-111111111111",
    date: DEMO_BUSINESS_DATE,
    scope: "company",
    subjectId: null,
    version: "1.0.0",
    catalogVersion: "2.0.0-sprint2",
    metadata: {},
  }
}

test("Sprint 11: telemetry enabled outside production", () => {
  assert.equal(isPerformanceTelemetryEnabled(), process.env.NODE_ENV !== "production")
})

test("Sprint 11: manual session builds a consistent PerformanceReport", () => {
  clearPerformanceReports()

  const session = startPerformanceTelemetry("manual")
  assert.equal(session.enabled, isPerformanceTelemetryEnabled())

  if (!session.enabled) return

  session.addEvents(5)
  session.addIndicators(3)
  session.markStage("normalize", 1.5)
  session.markStage("snapshot_builder", 2.5)
  session.recordSnapshotBuilt(1)
  session.recordDigestBuilt(1)
  session.recordBriefBuilt(1)
  session.setMetadata("test", true)

  const report = session.finish()
  assert.ok(report)
  assert.equal(report.source, "manual")
  assert.equal(report.eventCount, 5)
  assert.equal(report.indicatorCount, 3)
  assert.equal(report.snapshotsBuilt, 1)
  assert.equal(report.digestsBuilt, 1)
  assert.equal(report.briefsBuilt, 1)
  assert.equal(report.stageDurationsMs.normalize, 1.5)
  assert.equal(report.stageDurationsMs.snapshot_builder, 2.5)
  assert.ok(report.totalDurationMs >= 0)
  assert.equal(getLastPerformanceReport()?.id, report.id)
  assert.equal(listPerformanceReports().length, 1)
})

test("Sprint 11: Shadow hook records telemetry without changing outcome", () => {
  clearPerformanceReports()

  const outcome = runShadowPipeline({
    events: DEMO_ACTIVITY_DATASET,
    context: companyContext(),
  })

  assert.equal(outcome.metrics.discarded, true)
  assert.equal("snapshot" in outcome, false)

  if (!isPerformanceTelemetryEnabled()) return

  const last = getLastPerformanceReport()
  assert.ok(last)
  assert.equal(last.source, "shadow")
  assert.equal(last.eventCount, DEMO_ACTIVITY_DATASET.length)
  assert.ok(last.indicatorCount > 0)
  assert.equal(last.snapshotsBuilt, 1)
  assert.equal(last.digestsBuilt, 1)
  assert.equal(last.briefsBuilt, 1)
  assert.ok(last.stageDurationsMs.shadow_total >= 0)
})

test("Sprint 11: Facade hook records snapshot metrics; results unchanged", () => {
  clearPerformanceReports()

  const events = [
    {
      id: "1",
      module: "tasks",
      action: "workorder.finished",
      entityType: "task",
      entityId: "t1",
      employeeId: "e1",
      createdAt: "2026-08-01T12:00:00.000Z",
      metadata: {},
    },
  ]

  const snapshot = indicatorFacade.getSnapshot(events)
  assert.ok(typeof snapshot.values.events_total === "number")

  if (!isPerformanceTelemetryEnabled()) return

  const last = getLastPerformanceReport()
  assert.ok(last)
  assert.equal(last.source, "facade")
  assert.equal(last.eventCount, 1)
  assert.equal(last.snapshotsBuilt, 1)
  assert.ok(last.stageDurationsMs.facade_get_snapshot >= 0)
})

test("Sprint 11: Comparator hook records report; summary aggregates", () => {
  clearPerformanceReports()

  buildComparisonReport({
    legacySnapshot: { values: { events_total: 1 } },
    nextSnapshot: {
      identity: {
        companyId: "c1",
        date: DEMO_BUSINESS_DATE,
        scope: "company",
        subjectId: null,
        version: "1",
      },
      payload: {
        indicators: { events_total: 1 },
        status: "ready",
        timestamps: {
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
          calculatedAt: null,
        },
        metadata: {},
        version: "1",
      },
    },
    legacyDigest: { items: [] },
    nextDigest: { items: [] },
    legacyBrief: {
      date: DEMO_BUSINESS_DATE,
      narrative: "ok",
      generalState: [],
      production: [],
      operationalAlerts: [],
      relevantActivity: [],
      snapshot: { values: { events_total: 1 } },
      firstEventAt: null,
      lastEventAt: null,
      activeTimeMs: 0,
    },
    nextBrief: {
      identity: {
        companyId: "c1",
        date: DEMO_BUSINESS_DATE,
        scope: "company",
        subjectId: null,
        version: "1",
      },
      date: DEMO_BUSINESS_DATE,
      narrative: "ok",
      generalState: [],
      production: [],
      operationalAlerts: [],
      relevantActivity: [],
      snapshot: {
        identity: {
          companyId: "c1",
          date: DEMO_BUSINESS_DATE,
          scope: "company",
          subjectId: null,
          version: "1",
        },
        payload: {
          indicators: { events_total: 1 },
          status: "ready",
          timestamps: {
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
            calculatedAt: null,
          },
          metadata: {},
          version: "1",
        },
      },
      digest: {
        identity: {
          companyId: "c1",
          date: DEMO_BUSINESS_DATE,
          scope: "company",
          subjectId: null,
          version: "1",
        },
        items: [],
        limit: 20,
        updatedAt: "2026-08-01T00:00:00.000Z",
        version: "1",
      },
      firstEventAt: null,
      lastEventAt: null,
      activeTimeMs: 0,
    },
  })

  if (!isPerformanceTelemetryEnabled()) return

  const last = getLastPerformanceReport()
  assert.ok(last)
  assert.equal(last.source, "comparator")
  assert.equal(last.metadata.match, true)

  const summary = getPerformanceTelemetrySummary()
  assert.equal(summary.reportCount, 1)
  assert.ok(summary.totalDurationMs >= 0)
})
