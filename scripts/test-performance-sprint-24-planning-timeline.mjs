import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildPlanningTimelineReadModel,
  isBusinessIncidentReason,
  preparePlanningTimelineExport,
} from "../lib/analysis/planning-timeline/index.ts"
import { analysisQueryKeys } from "../lib/analysis/react-query/keys.ts"

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

function sampleCrew() {
  return {
    id: "crew-norte",
    name: "Cuadrilla Norte",
    status: "activa",
    habitualStartTime: "08:00:00",
    operationalBaseName: "Base Norte",
    vehicleLabel: "AB 123 CD",
    members: [
      { name: "Ana Pérez", role: "Técnico", active: true },
      { name: "Luis Gómez", role: "Ayudante", active: true },
    ],
  }
}

test("Sprint 24: builds chronological story with start, travel, OT, end", () => {
  const model = buildPlanningTimelineReadModel({
    date: "2026-08-01",
    executiveBrief: sampleBrief(),
    crew: sampleCrew(),
    tasks: [
      {
        id: "t1",
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
        crewId: "crew-norte",
        crew: "Cuadrilla Norte",
        dispatchOrder: 1,
        executionOrder: 1,
        incidentReason: null,
        incidentObservation: null,
        taskMetadata: {
          travel_from_previous_minutes: 15,
          travel_from_previous_distance_meters: 4200,
        },
      },
      {
        id: "t2",
        title: "Reparación",
        status: "incidencia",
        dueDate: "2026-08-01",
        estimatedDuration: "50 min",
        scheduledTime: "11:00",
        customerName: "Cliente B",
        customerId: "cust-2",
        serviceType: "Reparación",
        serviceAddress: "Calle 2",
        locality: "Norte",
        crewId: "crew-norte",
        crew: "Cuadrilla Norte",
        dispatchOrder: 2,
        executionOrder: 2,
        incidentReason: "cliente-ausente",
        incidentObservation: "Nadie atendió",
        taskMetadata: {
          travel_from_previous_minutes: 20,
          return_to_base_minutes: 18,
        },
      },
    ],
    now: 1,
  })

  assert.equal(model.crewName, "Cuadrilla Norte")
  assert.equal(model.cards[0]?.kind, "day-start")
  assert.equal(model.cards[0]?.kind === "day-start" && model.cards[0].vehicleLabel, "AB 123 CD")
  assert.ok(model.cards.some((card) => card.kind === "travel"))
  assert.ok(model.cards.some((card) => card.kind === "work-order"))
  assert.ok(model.cards.some((card) => card.kind === "incident"))
  assert.equal(model.cards[model.cards.length - 1]?.kind, "day-end")
  assert.equal(model.summary.finishedOt, 1)
  assert.equal(model.summary.pendingOt, 1)
  assert.ok((model.summary.travelMinutes ?? 0) >= 15)
  assert.equal(model.summary.distanceKm, 4.2)

  const serialized = JSON.stringify(model)
  assert.equal(serialized.includes("OT-"), false)
  assert.equal(serialized.includes("t1"), true) // taskId for nav only
})

test("Sprint 24: hides technical incidents", () => {
  assert.equal(isBusinessIncidentReason("problema-tecnico"), false)
  assert.equal(isBusinessIncidentReason("cliente-ausente"), true)
  assert.equal(isBusinessIncidentReason("acceso-denegado"), true)

  const model = buildPlanningTimelineReadModel({
    date: "2026-08-01",
    executiveBrief: sampleBrief(),
    crew: sampleCrew(),
    tasks: [
      {
        id: "t-tech",
        title: "Falla",
        status: "incidencia",
        dueDate: "2026-08-01",
        estimatedDuration: "30 min",
        scheduledTime: "10:00",
        customerName: "Cliente C",
        customerId: null,
        serviceType: "Soporte",
        serviceAddress: null,
        locality: null,
        crewId: "crew-norte",
        crew: "Cuadrilla Norte",
        dispatchOrder: 1,
        executionOrder: 1,
        incidentReason: "problema-tecnico",
        incidentObservation: "stack trace",
        taskMetadata: {},
      },
    ],
  })

  assert.equal(
    model.cards.filter((card) => card.kind === "incident").length,
    0
  )
})

test("Sprint 24: export stubs not ready", () => {
  const model = buildPlanningTimelineReadModel({
    date: "2026-08-01",
    executiveBrief: sampleBrief(),
    crew: sampleCrew(),
    tasks: [],
  })
  for (const format of /** @type {const} */ (["pdf", "print", "share"])) {
    const result = preparePlanningTimelineExport({ format, model })
    assert.equal(result.ready, false)
  }
})

test("Sprint 24: React Query key + timeline builder remains Activity-Engine free", () => {
  assert.deepEqual(
    analysisQueryKeys.planningTimeline("2026-08-01", "crew-norte"),
    ["analysis", "planning-timeline", "2026-08-01", "crew-norte"]
  )

  const ui = readFileSync(
    join(ROOT, "components/activity/crews-module.tsx"),
    "utf8"
  )
  assert.ok(ui.includes("Timeline Operativo"))
  assert.equal(ui.includes("getEmployeeActivity"), false)
  assert.equal(ui.includes("from(\"activity_events\")"), false)

  const loader = readFileSync(
    join(ROOT, "lib/analysis/planning-timeline/load-read-model.server.ts"),
    "utf8"
  )
  assert.ok(loader.includes("loadSituationRoomViaDualRead"))
  assert.ok(loader.includes("drainAnalysisCompanyDayEvents"))
  assert.equal(loader.includes("getEmployeeActivity"), false)
})

test("Sprint 24: access redirected into CUADRILLAS expediente", () => {
  const redirect = readFileSync(
    join(ROOT, "app/(dashboard)/activity/timeline-operativo/page.tsx"),
    "utf8"
  )
  assert.ok(redirect.includes("/activity/cuadrillas"))

  const reports = readFileSync(
    join(ROOT, "components/reportes/reports-module.tsx"),
    "utf8"
  )
  assert.ok(reports.includes("hrefCuadrillas"))

  const toolbar = readFileSync(
    join(ROOT, "components/planificacion/planning-toolbar.tsx"),
    "utf8"
  )
  assert.ok(toolbar.includes("timelineHref"))
})

test("Sprint 24: no SELECT * in timeline sources", () => {
  const sources = readFileSync(
    join(ROOT, "lib/analysis/planning-timeline/load-sources.server.ts"),
    "utf8"
  )
  assert.equal(sources.includes("select(\"*\")"), false)
  assert.equal(sources.includes("select('*')"), false)
  assert.ok(sources.includes("PLANNING_TIMELINE_TASK_SELECT"))
})
