import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  ANALYSIS_TIMELINE_DRAIN_PAGE_SIZE,
  buildCrewLookupIndexes,
  resolveCrewIdFromIndexes,
} from "../lib/analysis/queries/index.ts"
import { getCrewProductivity } from "../lib/reports/crew-productivity.ts"

test("Sprint 17: analysis drains use max page size (no 50-row chatty loops)", () => {
  assert.equal(ANALYSIS_TIMELINE_DRAIN_PAGE_SIZE, 200)

  const companyDayDrain = readFileSync(
    join(process.cwd(), "lib/analysis/queries/drain-company-day-events.ts"),
    "utf8"
  )
  assert.ok(companyDayDrain.includes("ACTIVITY_QUERY_MAX_LIMIT"))
  assert.equal(companyDayDrain.includes("ACTIVITY_TIMELINE_PAGE_SIZE"), false)

  const opsRoute = readFileSync(
    join(process.cwd(), "app/api/activity/operations-intelligence/route.ts"),
    "utf8"
  )
  const workforceRoute = readFileSync(
    join(process.cwd(), "app/api/activity/workforce-monitor/route.ts"),
    "utf8"
  )
  assert.ok(opsRoute.includes("drainAnalysisCompanyDayEvents"))
  assert.ok(workforceRoute.includes("drainAnalysisCompanyDayEvents"))
  assert.equal(opsRoute.includes("ACTIVITY_TIMELINE_PAGE_SIZE"), false)
  assert.equal(workforceRoute.includes("ACTIVITY_TIMELINE_PAGE_SIZE"), false)
})

test("Sprint 17: crew lookups use in-memory indexes (no per-task find scans)", () => {
  const crews = [
    { id: "c1", name: "Alpha" },
    { id: "c2", name: "Beta" },
  ]
  const indexes = buildCrewLookupIndexes(crews)

  assert.equal(resolveCrewIdFromIndexes({ crewId: "c1" }, indexes), "c1")
  assert.equal(
    resolveCrewIdFromIndexes({ crew: "beta" }, indexes),
    "c2"
  )
  assert.equal(resolveCrewIdFromIndexes({ crew: "missing" }, indexes), undefined)

  const tasks = [
    {
      id: "t1",
      code: "T1",
      title: "A",
      description: "",
      projectCode: "P",
      projectName: "P",
      type: "fiber",
      status: "programada",
      priority: "media",
      supervisor: "S",
      crewId: "c1",
      crew: "Alpha",
      startDate: "2026-08-01",
      dueDate: "2026-08-01",
      estimatedDuration: "60",
      checklist: [],
      progress: 0,
    },
    {
      id: "t2",
      code: "T2",
      title: "B",
      description: "",
      projectCode: "P",
      projectName: "P",
      type: "fiber",
      status: "finalizada",
      priority: "media",
      supervisor: "S",
      crew: "Beta",
      startDate: "2026-08-01",
      dueDate: "2026-08-01",
      completedAt: "2026-08-01",
      estimatedDuration: "60",
      checklist: [],
      progress: 100,
    },
  ]

  const rows = getCrewProductivity(
    tasks,
    { period: "custom", startDate: "2026-08-01", endDate: "2026-08-01" },
    crews
  )

  assert.equal(rows.length, 2)
  assert.ok(rows.some((row) => row.crewId === "c1"))
  assert.ok(rows.some((row) => row.crewId === "c2"))
})

test("Sprint 17: jornada uses shared timeline drain helper", () => {
  const jornadaHook = readFileSync(
    join(
      process.cwd(),
      "lib/analysis/react-query/use-jornada-period-events-query.ts"
    ),
    "utf8"
  )
  assert.ok(jornadaHook.includes("drainAnalysisTimelineEvents"))
  assert.equal(jornadaHook.includes("ACTIVITY_TIMELINE_PAGE_SIZE"), false)
})

test("Sprint 17: customer names resolved via batch helper (chunked .in)", () => {
  const helper = readFileSync(
    join(process.cwd(), "lib/analysis/queries/resolve-customer-names.ts"),
    "utf8"
  )
  assert.ok(helper.includes(".in("))
  assert.ok(helper.includes("CUSTOMER_ID_CHUNK_SIZE"))
  assert.equal(helper.includes(".eq(\"id\""), false)
})
