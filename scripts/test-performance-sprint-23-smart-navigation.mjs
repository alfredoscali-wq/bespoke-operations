import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildAnalysisBreadcrumb,
  buildAnalysisSearchParams,
  contextualizeAnalysisHref,
  hrefCrewProduction,
  hrefExecutiveCenter,
  hrefForSituationRoomAlert,
  hrefPlanning,
  mergeAnalysisNavContext,
  parseAnalysisNavContext,
  pushAnalysisTrail,
} from "../lib/analysis/smart-navigation/index.ts"

const ROOT = process.cwd()

test("Sprint 23: parse and build preserve date, crew, employee, trail", () => {
  const params = new URLSearchParams(
    "date=2026-08-01&crewId=crew-1&crewName=Norte&employeeId=emp-9&trail=executive-center|situation-room"
  )
  const context = parseAnalysisNavContext(params)
  assert.equal(context.date, "2026-08-01")
  assert.equal(context.crewId, "crew-1")
  assert.equal(context.crewName, "Norte")
  assert.equal(context.employeeId, "emp-9")
  assert.deepEqual(context.trail, ["executive-center", "situation-room"])

  const rebuilt = buildAnalysisSearchParams(context)
  assert.equal(rebuilt.get("date"), "2026-08-01")
  assert.equal(rebuilt.get("crewId"), "crew-1")
  assert.equal(rebuilt.get("trail"), "executive-center|situation-room")
})

test("Sprint 23: trail push de-dupes and appends", () => {
  assert.deepEqual(pushAnalysisTrail(["executive-center"], "executive-center"), [
    "executive-center",
  ])
  assert.deepEqual(
    pushAnalysisTrail(["executive-center", "situation-room"], "cuadrillas"),
    ["executive-center", "situation-room", "cuadrillas"]
  )
  assert.deepEqual(
    pushAnalysisTrail(["executive-center", "cuadrillas"], "executive-center"),
    ["cuadrillas", "executive-center"]
  )
})

test("Sprint 23: merge clears empty filter keys", () => {
  const merged = mergeAnalysisNavContext(
    { date: "2026-08-01", crewId: "c1", crewName: "Norte" },
    { crewId: "", crewName: "" }
  )
  assert.equal(merged.date, "2026-08-01")
  assert.equal(merged.crewId, undefined)
  assert.equal(merged.crewName, undefined)
})

test("Sprint 23: contextual hrefs keep filters and extend trail", () => {
  const base = {
    date: "2026-08-01",
    crewId: "crew-norte",
    trail: ["executive-center"],
  }
  const toCrew = hrefCrewProduction(base, "executive-center")
  assert.ok(toCrew.startsWith("/activity/cuadrillas?"))
  assert.ok(toCrew.includes("date=2026-08-01"))
  assert.ok(toCrew.includes("crewId=crew-norte"))
  assert.ok(toCrew.includes("trail=executive-center"))
  assert.ok(toCrew.includes("cuadrillas"))

  const toPlanning = hrefPlanning(
    { ...base, taskId: "task-ot-1" },
    "cuadrillas"
  )
  assert.ok(toPlanning.startsWith("/operations/planificacion?"))
  assert.ok(toPlanning.includes("taskId=task-ot-1"))
  assert.ok(toPlanning.includes("date=2026-08-01"))

  const fromBare = contextualizeAnalysisHref(
    "/activity/crew-production",
    base,
    "executive-center"
  )
  assert.equal(fromBare, toCrew)
})

test("Sprint 23: four-click path Centro → Cuadrillas → Planning OT", () => {
  const click1 = hrefExecutiveCenter({ date: "2026-08-01" }, null)
  assert.ok(click1.includes("/activity/executive-center"))

  const click2 = contextualizeAnalysisHref(
    "/activity/cuadrillas",
    { date: "2026-08-01", trail: ["executive-center"] },
    "executive-center"
  )
  assert.ok(click2.includes("/activity/cuadrillas"))
  assert.ok(click2.includes("date=2026-08-01"))

  const click4 = hrefPlanning(
    {
      date: "2026-08-01",
      crewId: "crew-norte",
      crewName: "Cuadrilla Norte",
      taskId: "ot-42",
      trail: ["executive-center", "cuadrillas"],
    },
    "cuadrillas"
  )
  assert.ok(click4.includes("/operations/planificacion"))
  assert.ok(click4.includes("taskId=ot-42"))
  assert.ok(click4.includes("crewId=crew-norte"))
  assert.ok(click4.includes("date=2026-08-01"))
})

test("Sprint 23: breadcrumb allows return steps", () => {
  const crumbs = buildAnalysisBreadcrumb({
    currentStep: "cuadrillas",
    context: {
      date: "2026-08-01",
      crewName: "Cuadrilla Norte",
      trail: ["executive-center", "situation-room"],
    },
  })
  assert.equal(crumbs[0]?.label, "Análisis")
  assert.ok(crumbs[0]?.href)
  assert.equal(crumbs[1]?.label, "Centro Ejecutivo")
  assert.ok(crumbs[1]?.href?.includes("/activity/executive-center"))
  assert.equal(crumbs[2]?.label, "Sala de Situación")
  assert.equal(crumbs[3]?.label, "Cuadrillas")
  assert.equal(crumbs[3]?.href, null)
  assert.equal(crumbs[4]?.label, "Cuadrilla Norte")
})

test("Sprint 23: alerts map to specific destinations", () => {
  assert.equal(
    hrefForSituationRoomAlert("ot_pending_day"),
    "/activity/cuadrillas"
  )
  assert.equal(
    hrefForSituationRoomAlert("consultations_waiting"),
    "/atencion-cliente"
  )
  assert.equal(
    hrefForSituationRoomAlert("ot_rescheduled"),
    "/operations/planificacion"
  )
})

test("Sprint 23: navigation-only — no API/query edits in smart-nav", () => {
  const apiRoute = readFileSync(
    join(ROOT, "app/api/activity/executive-center/route.ts"),
    "utf8"
  )
  assert.equal(apiRoute.includes("smart-navigation"), false)

  const crewApi = readFileSync(
    join(ROOT, "app/api/activity/crew-production/route.ts"),
    "utf8"
  )
  assert.equal(crewApi.includes("smart-navigation"), false)

  const params = readFileSync(
    join(ROOT, "lib/analysis/smart-navigation/params.ts"),
    "utf8"
  )
  assert.ok(params.includes("parseAnalysisNavContext"))
  assert.equal(params.includes("supabase"), false)
})

test("Sprint 23: modules wire breadcrumb + contextual links", () => {
  const executive = readFileSync(
    join(ROOT, "components/activity/executive-center-module.tsx"),
    "utf8"
  )
  assert.ok(executive.includes("AnalysisBreadcrumb"))
  assert.ok(executive.includes("contextualizeAnalysisHref"))

  const crews = readFileSync(
    join(ROOT, "components/activity/crews-module.tsx"),
    "utf8"
  )
  assert.ok(crews.includes("AnalysisBreadcrumb"))
  assert.ok(crews.includes("hrefPlanning"))
  assert.ok(crews.includes("taskId"))

  const sala = readFileSync(
    join(ROOT, "components/executive/situation-room-view.tsx"),
    "utf8"
  )
  assert.ok(sala.includes("hrefForSituationRoomAlert"))
  assert.ok(sala.includes("contextualizeAnalysisHref"))

  const planningFilters = readFileSync(
    join(ROOT, "lib/planificacion/planning-filters-session.ts"),
    "utf8"
  )
  assert.ok(planningFilters.includes("readPlanningFiltersFromUrl"))
  assert.ok(planningFilters.includes("taskId"))
})
