import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildCrewsReadModel,
  prepareCrewsExport,
  resolveCrewsPeriodRange,
} from "../lib/analysis/crews/index.ts"
import { analysisQueryKeys } from "../lib/analysis/react-query/keys.ts"
import { hrefCuadrillas } from "../lib/analysis/smart-navigation/index.ts"

const ROOT = process.cwd()

function sampleBrief() {
  return {
    scope: { kind: "company", label: "Empresa" },
    date: "2026-08-01",
    narrative: "Jornada operativa estable.",
    generalState: [],
    production: [],
    operationalAlerts: [],
    relevantActivity: [],
    snapshot: { values: { events_total: 3 } },
    firstEventAt: null,
    lastEventAt: null,
    activeTimeMs: 0,
  }
}

test("Sprint 25: period helpers resolve today / this_month", () => {
  const today = resolveCrewsPeriodRange({
    preset: "today",
    referenceDate: "2026-08-01",
  })
  assert.equal(today.dateFrom, "2026-08-01")
  assert.equal(today.dateTo, "2026-08-01")

  const week = resolveCrewsPeriodRange({
    preset: "last_7_days",
    referenceDate: "2026-08-01",
  })
  assert.equal(week.dateFrom, "2026-07-26")
  assert.equal(week.dateTo, "2026-08-01")

  const month = resolveCrewsPeriodRange({
    preset: "this_month",
    referenceDate: "2026-08-01",
  })
  assert.equal(month.dateFrom, "2026-08-01")
  assert.equal(month.dateTo, "2026-08-31")
})

test("Sprint 25: integrates production + timeline into one CrewsReadModel", () => {
  const period = resolveCrewsPeriodRange({
    preset: "today",
    referenceDate: "2026-08-01",
  })

  const model = buildCrewsReadModel({
    period,
    executiveBrief: sampleBrief(),
    crews: [
      {
        id: "c1",
        name: "Cuadrilla Norte",
        status: "activa",
        habitualStartTime: "08:00",
        operationalBaseName: "Base Norte",
        vehicleLabel: null,
        members: [{ name: "Ana", role: "Técnico", active: true }],
      },
    ],
    tasks: [
      {
        id: "t1",
        code: "OT-1",
        title: "Instalación",
        status: "finalizada",
        dueDate: "2026-08-01",
        estimatedDuration: "40 min",
        scheduledTime: "09:00",
        customerName: "Cliente A",
        customerId: "cust-1",
        serviceType: "Instalación",
        serviceAddress: "Calle 1",
        locality: "Centro",
        crewId: "c1",
        crew: "Cuadrilla Norte",
        dispatchOrder: 1,
        executionOrder: 1,
        incidentReason: null,
        incidentObservation: null,
        taskMetadata: { travel_from_previous_minutes: 12 },
      },
      {
        id: "t2",
        code: "OT-2",
        title: "Reparación",
        status: "incidencia",
        dueDate: "2026-08-01",
        estimatedDuration: "50 min",
        scheduledTime: "11:00",
        customerName: "Cliente B",
        customerId: null,
        serviceType: "Reparación",
        serviceAddress: null,
        locality: "Norte",
        crewId: "c1",
        crew: "Cuadrilla Norte",
        dispatchOrder: 2,
        executionOrder: 2,
        incidentReason: "cliente-ausente",
        incidentObservation: "Nadie",
        taskMetadata: {},
      },
    ],
    now: 1,
  })

  assert.ok(model.production)
  assert.equal(model.ranking.length, 1)
  assert.equal(model.ranking[0]?.assignedOt, 2)
  assert.equal(model.ranking[0]?.finishedOt, 1)

  const dossier = model.dossiersByCrewId.c1
  assert.ok(dossier)
  assert.ok(dossier.timeline.cards.length >= 3)
  assert.ok(dossier.timeline.cards.some((card) => card.kind === "day-start"))
  assert.ok(dossier.quality.some((metric) => metric.id === "cliente-ausente"))
  assert.equal(dossier.workOrders.length, 2)
  assert.equal(dossier.trends.length, 3)
  assert.equal(dossier.gpsCoverage.reserved, true)
})

test("Sprint 25: export stubs not ready", () => {
  const period = resolveCrewsPeriodRange({
    preset: "today",
    referenceDate: "2026-08-01",
  })
  const model = buildCrewsReadModel({
    period,
    executiveBrief: sampleBrief(),
    crews: [],
    tasks: [],
  })
  const result = prepareCrewsExport({ format: "pdf", model })
  assert.equal(result.ready, false)
})

test("Sprint 25: nav renamed + redirects + smart href", () => {
  const navItem = readFileSync(join(ROOT, "lib/navigation/nav-items.ts"), "utf8")
  assert.ok(navItem.includes('title: "Cuadrillas"'))
  assert.ok(navItem.includes('href: "/activity/cuadrillas"'))
  assert.equal(navItem.includes('title: "Producción de Cuadrillas"'), false)

  const order = readFileSync(
    join(ROOT, "lib/navigation/build-nav-from-modules.ts"),
    "utf8"
  )
  const pos = (needle) => order.indexOf(needle)
  assert.ok(pos("executiveCenterNavItem.href") < pos("activityNavItem.href"))
  assert.ok(pos("activityNavItem.href") < pos("workforceMonitorNavItem.href"))
  assert.ok(pos("workforceMonitorNavItem.href") < pos("dayActivityNavItem.href"))
  assert.ok(pos("dayActivityNavItem.href") < pos("crewProductionNavItem.href"))
  assert.ok(pos("crewProductionNavItem.href") < pos("activityTimelineNavItem.href"))

  const href = hrefCuadrillas({ date: "2026-08-01", crewId: "c1" }, "executive-center")
  assert.ok(href.startsWith("/activity/cuadrillas?"))
  assert.ok(href.includes("crewId=c1"))

  const redirectCrew = readFileSync(
    join(ROOT, "app/(dashboard)/activity/crew-production/page.tsx"),
    "utf8"
  )
  assert.ok(redirectCrew.includes("redirect"))
  assert.ok(redirectCrew.includes("/activity/cuadrillas"))

  const redirectTimeline = readFileSync(
    join(ROOT, "app/(dashboard)/activity/timeline-operativo/page.tsx"),
    "utf8"
  )
  assert.ok(redirectTimeline.includes("/activity/cuadrillas"))
})

test("Sprint 25: React Query key + no SELECT * + no Activity Engine in UI", () => {
  assert.deepEqual(
    analysisQueryKeys.cuadrillas("today", "2026-08-01", "2026-08-01"),
    ["analysis", "cuadrillas", "today", "2026-08-01", "2026-08-01"]
  )

  const sources = readFileSync(
    join(ROOT, "lib/analysis/crews/load-sources.server.ts"),
    "utf8"
  )
  assert.equal(sources.includes('select("*")'), false)
  assert.ok(sources.includes("CREWS_TASK_SELECT"))

  const ui = readFileSync(
    join(ROOT, "components/activity/crews-module.tsx"),
    "utf8"
  )
  assert.ok(ui.includes("useCrewsQuery"))
  assert.ok(ui.includes("CrewsDossierView"))
  assert.ok(ui.includes("AnalysisDateRangePicker"))
  assert.equal(ui.includes("getEmployeeActivity"), false)

  const dossierUi = readFileSync(
    join(ROOT, "components/activity/crews-dossier-view.tsx"),
    "utf8"
  )
  assert.ok(dossierUi.includes("Timeline Operativo"))
  assert.ok(dossierUi.includes("gpsCoverage"))
  assert.ok(dossierUi.includes("MapPinned"))

  const builder = readFileSync(
    join(ROOT, "lib/analysis/crews/builder.ts"),
    "utf8"
  )
  assert.ok(builder.includes("Cobertura GPS"))
  assert.ok(builder.includes("buildCrewProductionReadModel"))
  assert.ok(builder.includes("buildPlanningTimelineReadModel"))
})
