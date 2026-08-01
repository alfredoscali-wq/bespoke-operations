import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildCrewProductionNarrative,
  buildCrewProductionReadModel,
  prepareCrewProductionExport,
} from "../lib/analysis/crew-production/index.ts"
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

function sampleInput() {
  return {
    date: "2026-08-01",
    executiveBrief: sampleBrief(),
    crews: [
      {
        id: "c1",
        name: "Cuadrilla Norte",
        status: "activa",
        memberCount: 3,
      },
      {
        id: "c2",
        name: "Cuadrilla Sur",
        status: "activa",
        memberCount: 2,
      },
    ],
    tasks: [
      {
        id: "t1",
        code: "OT-1",
        title: "Instalación",
        status: "finalizada",
        dueDate: "2026-08-01",
        estimatedDuration: "45 min",
        customerName: "Cliente A",
        crewId: "c1",
        crew: "Cuadrilla Norte",
        taskMetadata: {},
      },
      {
        id: "t2",
        code: "OT-2",
        title: "Reparación",
        status: "asignada",
        dueDate: "2026-08-01",
        estimatedDuration: "60 min",
        customerName: "Cliente B",
        crewId: "c1",
        crew: "Cuadrilla Norte",
        taskMetadata: {},
      },
      {
        id: "t3",
        code: "OT-3",
        title: "Cambio de domicilio",
        status: "finalizada",
        dueDate: "2026-08-01",
        estimatedDuration: "90 min",
        customerName: "Cliente C",
        crewId: "c2",
        crew: "Cuadrilla Sur",
        taskMetadata: {
          travelFromPreviousDistanceMeters: 1200,
        },
      },
    ],
  }
}

test("Sprint 21: builds crew production read model with KPIs, ranking, detail, journey", () => {
  const model = buildCrewProductionReadModel(sampleInput())

  assert.equal(model.date, "2026-08-01")
  assert.equal(model.executiveBrief.narrative, "Jornada operativa estable.")
  assert.equal(model.kpis.finishedOt, 2)
  assert.equal(model.kpis.pendingOt, 1)
  assert.equal(model.kpis.activeCrews, 2)
  assert.ok(model.ranking.length === 2)
  assert.ok(model.detailsByCrewId.c1)
  assert.ok(model.detailsByCrewId.c1.narrative.includes("Cuadrilla Norte"))
  assert.equal(model.detailsByCrewId.c1.journey.length, 2)
  assert.equal(model.detailsByCrewId.c1.journey[0].customerName, "Cliente A")
  assert.ok(
    model.detailsByCrewId.c1.indicators.some((i) => i.id === "finished")
  )
})

test("Sprint 21: narrative is business story without technical event jargon", () => {
  const text = buildCrewProductionNarrative({
    crewName: "Cuadrilla Norte",
    finished: 17,
    programmed: 18,
    cancelled: 0,
    avgMinutes: 42,
  })
  assert.ok(text.includes("17"))
  assert.ok(text.includes("94%"))
  assert.ok(text.includes("No registró cancelaciones"))
  assert.ok(text.includes("42 minutos"))
  assert.equal(text.includes("activity_events"), false)
  assert.equal(text.includes("SELECT"), false)
})

test("Sprint 21: export stubs are not ready yet", () => {
  const model = buildCrewProductionReadModel(sampleInput())
  for (const format of /** @type {const} */ (["pdf", "csv", "print"])) {
    const result = prepareCrewProductionExport({ format, model })
    assert.equal(result.ready, false)
    assert.equal(result.format, format)
    assert.ok(result.message.includes("próximo sprint"))
  }
})

test("Sprint 21: React Query key is stable and unique", () => {
  assert.deepEqual(analysisQueryKeys.crewProduction("2026-08-01"), [
    "analysis",
    "crew-production",
    "2026-08-01",
  ])
  assert.notDeepEqual(
    analysisQueryKeys.crewProduction("2026-08-01"),
    analysisQueryKeys.workforceMonitor("2026-08-01")
  )
})

test("Sprint 21: lean selects — no SELECT * in crew-production sources", () => {
  const source = readFileSync(
    join(ROOT, "lib/analysis/crew-production/load-sources.server.ts"),
    "utf8"
  )
  assert.equal(source.includes('.select("*")'), false)
  assert.ok(source.includes("CREW_PRODUCTION_TASK_SELECT"))
  assert.ok(source.includes("CREW_PRODUCTION_CREW_SELECT"))
  assert.ok(source.includes("crew_members(id, active)"))
  assert.equal(source.includes("operational_steps"), false)
  assert.equal(source.includes("checklist"), false)
})

test("Sprint 21: API uses Facade dual-read; module does not query Activity Engine", () => {
  const loader = readFileSync(
    join(ROOT, "lib/analysis/crew-production/load-read-model.server.ts"),
    "utf8"
  )
  assert.ok(loader.includes("loadSituationRoomViaDualRead"))
  assert.ok(loader.includes("buildCrewProductionReadModel"))

  const moduleSource = readFileSync(
    join(ROOT, "components/activity/crews-module.tsx"),
    "utf8"
  )
  assert.ok(moduleSource.includes("useCrewsQuery"))
  assert.equal(moduleSource.includes("getActivityEvents"), false)
  assert.equal(moduleSource.includes("drainAnalysis"), false)
  assert.equal(moduleSource.includes("from(\"tasks\")"), false)
})
