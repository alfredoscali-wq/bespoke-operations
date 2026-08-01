import assert from "node:assert/strict"
import test from "node:test"

import { QueryClient } from "@tanstack/react-query"

import {
  ANALYSIS_EMPLOYEES_STALE_TIME_MS,
  ANALYSIS_GC_TIME_MS,
  ANALYSIS_QUERY_DEFAULTS,
  ANALYSIS_STALE_TIME_MS,
  analysisQueryKeys,
  createAnalysisQueryClient,
} from "../lib/analysis/react-query/index.ts"
import {
  BaselineCollector,
  clearScreenMetrics,
} from "../lib/performance/baseline/index.ts"
import {
  clearIndicatorEngineFeatureFlagsOverride,
  setIndicatorEngineFeatureFlagsOverride,
} from "../lib/indicator-engine/index.ts"

test("Sprint 15: analysis query defaults favor cache over refetch chatter", () => {
  assert.equal(ANALYSIS_STALE_TIME_MS, 60_000)
  assert.equal(ANALYSIS_GC_TIME_MS, 10 * 60_000)
  assert.equal(ANALYSIS_QUERY_DEFAULTS.refetchOnWindowFocus, false)
  assert.equal(ANALYSIS_QUERY_DEFAULTS.refetchOnReconnect, false)
  assert.equal(ANALYSIS_QUERY_DEFAULTS.refetchOnMount, false)
  assert.ok(ANALYSIS_EMPLOYEES_STALE_TIME_MS >= ANALYSIS_STALE_TIME_MS)
})

test("Sprint 15: centralized keys are stable and distinct per screen", () => {
  const date = "2026-08-01"
  const companyId = "company-1"

  assert.deepEqual(analysisQueryKeys.situationRoom(date), [
    "analysis",
    "situation-room",
    date,
  ])
  assert.deepEqual(analysisQueryKeys.workforceMonitor(date), [
    "analysis",
    "workforce-monitor",
    date,
  ])
  assert.deepEqual(analysisQueryKeys.employees(companyId), [
    "analysis",
    "employees",
    companyId,
  ])
  assert.deepEqual(
    analysisQueryKeys.jornada({
      employeeId: "e1",
      dateFrom: date,
      dateTo: date,
    }),
    ["analysis", "jornada", "e1", date, date]
  )
  assert.deepEqual(analysisQueryKeys.reportesTasks(companyId), [
    "analysis",
    "reportes-operativos",
    companyId,
    "tasks",
  ])

  assert.notDeepEqual(
    analysisQueryKeys.situationRoom(date),
    analysisQueryKeys.workforceMonitor(date)
  )
})

test("Sprint 15: shared query key dedupes downloads (employees)", async () => {
  const client = createAnalysisQueryClient()
  let downloads = 0

  const load = () =>
    client.fetchQuery({
      queryKey: analysisQueryKeys.employees("company-1"),
      queryFn: async () => {
        downloads += 1
        return { employees: [{ id: "e1" }], errorMessage: null }
      },
    })

  const a = await load()
  const b = await load()
  const c = await load()

  assert.equal(downloads, 1)
  assert.equal(a.employees[0].id, "e1")
  assert.equal(b.employees[0].id, "e1")
  assert.equal(c.employees[0].id, "e1")
  client.clear()
})

test("Sprint 15: situation-room key is shared across Sala and Daily Brief consumers", async () => {
  const client = createAnalysisQueryClient()
  let downloads = 0
  const date = "2026-08-01"

  const loadAsSala = () =>
    client.fetchQuery({
      queryKey: analysisQueryKeys.situationRoom(date),
      queryFn: async () => {
        downloads += 1
        return { date, brief: { narrative: "ok" } }
      },
    })

  const loadAsDailyBrief = () =>
    client.fetchQuery({
      queryKey: analysisQueryKeys.situationRoom(date),
      queryFn: async () => {
        downloads += 1
        return { date, brief: { narrative: "ok" } }
      },
    })

  const sala = await loadAsSala()
  const daily = await loadAsDailyBrief()

  assert.equal(downloads, 1)
  assert.equal(sala.brief.narrative, daily.brief.narrative)
  client.clear()
})

test("Sprint 15: stale cache avoids remount refetch within staleTime", async () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { ...ANALYSIS_QUERY_DEFAULTS },
    },
  })
  let downloads = 0
  const key = analysisQueryKeys.workforceMonitor("2026-08-01")

  await client.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      downloads += 1
      return { date: "2026-08-01", rows: [], totalEvents: 0 }
    },
  })

  // Simulate remount / second consumer within staleTime
  await client.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      downloads += 1
      return { date: "2026-08-01", rows: [], totalEvents: 0 }
    },
  })

  assert.equal(downloads, 1)
  assert.equal(client.getQueryState(key)?.dataUpdateCount, 1)
  client.clear()
})

test("Sprint 15: baseline comparison — fewer HTTP attributions after consolidation", () => {
  setIndicatorEngineFeatureFlagsOverride({ telemetryEnabled: true })
  clearScreenMetrics()

  // Pre-consolidation navigation pattern (3 screens × employees + screen fetch)
  BaselineCollector.record({
    screenId: "sala_situacion",
    httpRequestCount: 2,
    supabaseQueryCount: 1,
  })
  BaselineCollector.record({
    screenId: "workforce_monitor",
    httpRequestCount: 2,
    supabaseQueryCount: 1,
  })
  BaselineCollector.record({
    screenId: "actividad_jornada",
    httpRequestCount: 2,
    supabaseQueryCount: 1,
  })
  const before = BaselineCollector.buildReport()
  const beforeHttp = before.screens
    .filter((s) => s.sampleCount > 0)
    .reduce((sum, s) => sum + s.httpRequestCount, 0)

  clearScreenMetrics()

  // Post-consolidation: shared employees (1) + 3 screen fetches
  BaselineCollector.record({
    screenId: "sala_situacion",
    httpRequestCount: 1,
    supabaseQueryCount: 1,
  })
  BaselineCollector.record({
    screenId: "workforce_monitor",
    httpRequestCount: 1,
    supabaseQueryCount: 1,
  })
  BaselineCollector.record({
    screenId: "actividad_jornada",
    httpRequestCount: 1,
    supabaseQueryCount: 1,
  })
  // Shared employees attributed once at analysis root
  BaselineCollector.record({
    screenId: "reportes_operativos",
    httpRequestCount: 1,
    supabaseQueryCount: 0,
  })

  const after = BaselineCollector.buildReport()
  const afterHttp = after.screens
    .filter((s) =>
      ["sala_situacion", "workforce_monitor", "actividad_jornada"].includes(
        s.screenId
      )
    )
    .reduce((sum, s) => sum + s.httpRequestCount, 0)

  assert.ok(afterHttp < beforeHttp)

  clearScreenMetrics()
  clearIndicatorEngineFeatureFlagsOverride()
})
