import assert from "node:assert/strict"
import test from "node:test"

import {
  clearPerformanceReports,
  setIndicatorEngineFeatureFlagsOverride,
  clearIndicatorEngineFeatureFlagsOverride,
  startPerformanceTelemetry,
} from "../lib/indicator-engine/index.ts"
import {
  BaselineCollector,
  BASELINE_SCREEN_IDS,
  buildBaselineReport,
  clearScreenMetrics,
} from "../lib/performance/baseline/index.ts"

function enableBaseline() {
  setIndicatorEngineFeatureFlagsOverride({ telemetryEnabled: true })
}

function disableBaseline() {
  setIndicatorEngineFeatureFlagsOverride({ telemetryEnabled: false })
}

function reset() {
  clearIndicatorEngineFeatureFlagsOverride()
  clearScreenMetrics()
  clearPerformanceReports()
}

test("Sprint 14 Baseline: record produces consistent ScreenMetrics", () => {
  reset()
  enableBaseline()
  clearScreenMetrics()

  const a = BaselineCollector.record({
    screenId: "sala_situacion",
    httpRequestCount: 2,
    supabaseQueryCount: 3,
    rpcCount: 1,
    totalLoadTimeMs: 100,
    renderTimeMs: 20,
    eventsProcessed: 50,
    estimatedPayloadBytes: 4096,
    indicatorsCalculated: 41,
    executiveBriefsGenerated: 1,
    recordedAt: "2026-08-01T12:00:00.000Z",
  })

  assert.ok(a)
  assert.equal(a.screenId, "sala_situacion")
  assert.equal(a.label, "Sala de Situación")
  assert.equal(a.httpRequestCount, 2)
  assert.equal(a.supabaseQueryCount, 3)
  assert.equal(a.rpcCount, 1)
  assert.equal(a.totalLoadTimeMs, 100)
  assert.equal(a.renderTimeMs, 20)
  assert.equal(a.eventsProcessed, 50)
  assert.equal(a.estimatedPayloadBytes, 4096)
  assert.equal(a.indicatorsCalculated, 41)
  assert.equal(a.executiveBriefsGenerated, 1)
  assert.equal(a.sampleCount, 1)

  const again = BaselineCollector.get("sala_situacion")
  assert.deepEqual(again, a)

  reset()
})

test("Sprint 14 Baseline: merge averages across samples", () => {
  reset()
  enableBaseline()
  clearScreenMetrics()

  BaselineCollector.record({
    screenId: "workforce_monitor",
    httpRequestCount: 2,
    totalLoadTimeMs: 100,
    estimatedPayloadBytes: 1000,
  })
  const merged = BaselineCollector.record({
    screenId: "workforce_monitor",
    httpRequestCount: 4,
    totalLoadTimeMs: 200,
    estimatedPayloadBytes: 3000,
  })

  assert.ok(merged)
  assert.equal(merged.sampleCount, 2)
  assert.equal(merged.httpRequestCount, 3)
  assert.equal(merged.totalLoadTimeMs, 150)
  assert.equal(merged.estimatedPayloadBytes, 2000)

  reset()
})

test("Sprint 14 Baseline: report ranks by load time → queries → payload", () => {
  reset()
  enableBaseline()
  clearScreenMetrics()

  BaselineCollector.record({
    screenId: "sala_situacion",
    totalLoadTimeMs: 50,
    supabaseQueryCount: 10,
    estimatedPayloadBytes: 9000,
  })
  BaselineCollector.record({
    screenId: "workforce_monitor",
    totalLoadTimeMs: 200,
    supabaseQueryCount: 2,
    estimatedPayloadBytes: 1000,
  })
  BaselineCollector.record({
    screenId: "actividad_jornada",
    totalLoadTimeMs: 200,
    supabaseQueryCount: 5,
    estimatedPayloadBytes: 500,
  })
  BaselineCollector.record({
    screenId: "reportes_operativos",
    totalLoadTimeMs: 80,
    supabaseQueryCount: 1,
    rpcCount: 2,
    estimatedPayloadBytes: 8000,
  })

  const report = BaselineCollector.buildReport()
  assert.equal(report.enabled, true)
  assert.equal(report.screens.length, 4)

  // Primary order: load time desc; tie → query count (supabase+rpc) desc
  assert.equal(report.screens[0].screenId, "actividad_jornada") // 200ms, 5 queries
  assert.equal(report.screens[1].screenId, "workforce_monitor") // 200ms, 2 queries
  assert.equal(report.ranking.byLoadTime[0], "actividad_jornada")

  assert.equal(report.ranking.byQueryCount[0], "sala_situacion") // 10 queries
  assert.equal(report.ranking.byPayloadSize[0], "sala_situacion") // 9000 bytes

  // All scoped screens present
  const ids = new Set(report.screens.map((s) => s.screenId))
  for (const id of BASELINE_SCREEN_IDS) {
    assert.ok(ids.has(id))
  }

  reset()
})

test("Sprint 14 Baseline: screen session uses Sprint 11 telemetry", () => {
  reset()
  enableBaseline()
  clearScreenMetrics()
  clearPerformanceReports()

  const session = BaselineCollector.startScreen("reportes_operativos")
  assert.equal(session.enabled, true)
  session.recordHttpRequest(1)
  session.recordSupabaseQuery(2)
  session.recordRpc(1)
  session.recordEvents(12)
  session.recordIndicators(8)
  session.recordExecutiveBrief(1)
  session.recordPayloadBytes(2048)
  session.recordRenderTime(15)

  const metrics = session.finish()
  assert.ok(metrics)
  assert.equal(metrics.screenId, "reportes_operativos")
  assert.equal(metrics.httpRequestCount, 1)
  assert.equal(metrics.supabaseQueryCount, 2)
  assert.equal(metrics.rpcCount, 1)
  assert.equal(metrics.eventsProcessed, 12)
  assert.equal(metrics.indicatorsCalculated, 8)
  assert.equal(metrics.executiveBriefsGenerated, 1)
  assert.equal(metrics.estimatedPayloadBytes, 2048)
  assert.equal(metrics.renderTimeMs, 15)
  assert.ok(metrics.totalLoadTimeMs >= 0)

  reset()
})

test("Sprint 14 Baseline: ingestFromTelemetry maps dual_read to Sala", () => {
  reset()
  enableBaseline()
  clearScreenMetrics()
  clearPerformanceReports()

  const session = startPerformanceTelemetry("dual_read")
  session.addEvents(7)
  session.addIndicators(41)
  session.recordBriefBuilt(1)
  session.setMetadata("estimatedPayloadBytes", 5120)
  session.setMetadata("httpRequestCount", 1)
  session.markStage("dual_read_v1", 30)
  session.finish()

  const ingested = BaselineCollector.ingestFromTelemetry()
  assert.equal(ingested, 1)

  const sala = BaselineCollector.get("sala_situacion")
  assert.ok(sala)
  assert.equal(sala.eventsProcessed, 7)
  assert.equal(sala.indicatorsCalculated, 41)
  assert.equal(sala.executiveBriefsGenerated, 1)
  assert.equal(sala.estimatedPayloadBytes, 5120)
  assert.equal(sala.httpRequestCount, 1)

  reset()
})

test("Sprint 14 Baseline: disabled → zero cost / null records", () => {
  reset()
  disableBaseline()
  clearScreenMetrics()

  assert.equal(BaselineCollector.isEnabled(), false)
  assert.equal(
    BaselineCollector.record({
      screenId: "sala_situacion",
      totalLoadTimeMs: 999,
    }),
    null
  )
  assert.equal(BaselineCollector.startScreen("sala_situacion").enabled, false)
  assert.equal(BaselineCollector.ingestFromTelemetry(), 0)

  const report = buildBaselineReport("2026-08-01T00:00:00.000Z")
  assert.equal(report.enabled, false)
  assert.equal(report.screens.length, 4)
  assert.ok(report.screens.every((s) => s.sampleCount === 0))

  reset()
})

test("Sprint 14 Baseline: negative / invalid inputs clamp to zero", () => {
  reset()
  enableBaseline()
  clearScreenMetrics()

  const m = BaselineCollector.record({
    screenId: "actividad_jornada",
    httpRequestCount: -3,
    totalLoadTimeMs: Number.NaN,
    eventsProcessed: -1,
  })
  assert.ok(m)
  assert.equal(m.httpRequestCount, 0)
  assert.equal(m.totalLoadTimeMs, 0)
  assert.equal(m.eventsProcessed, 0)

  reset()
})
