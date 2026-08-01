import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildCrewsDayJourneys,
  formatCrewsDayHeading,
  formatCrewsWorkedDuration,
  isCrewsSingleDayPeriod,
  resolveCrewsDossierTitle,
  resolveCrewsSidePeriodSummary,
} from "../lib/analysis/crews/dossier-presentation.ts"

const ROOT = process.cwd()

test("Sprint 27: Hoy / Ayer keep single-day timeline mode", () => {
  assert.equal(
    isCrewsSingleDayPeriod({
      preset: "today",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-01",
      focusDate: "2026-08-01",
    }),
    true
  )
  assert.equal(
    isCrewsSingleDayPeriod({
      preset: "yesterday",
      dateFrom: "2026-07-31",
      dateTo: "2026-07-31",
      focusDate: "2026-07-31",
    }),
    true
  )
})

test("Sprint 27: multi-day presets group by jornada", () => {
  for (const preset of [
    "last_7_days",
    "last_30_days",
    "this_month",
    "last_month",
    "custom",
  ]) {
    assert.equal(
      isCrewsSingleDayPeriod({
        preset,
        dateFrom: "2026-07-01",
        dateTo: "2026-07-31",
        focusDate: "2026-07-31",
      }),
      false,
      preset
    )
  }
})

test("Sprint 27: dossier titles adapt to period", () => {
  assert.equal(
    resolveCrewsDossierTitle({
      preset: "today",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-01",
      focusDate: "2026-08-01",
    }).title,
    "Jornada de la Cuadrilla"
  )
  assert.equal(
    resolveCrewsDossierTitle({
      preset: "last_7_days",
      dateFrom: "2026-07-26",
      dateTo: "2026-08-01",
      focusDate: "2026-08-01",
    }).title,
    "Semana Operativa de la Cuadrilla"
  )
  assert.equal(
    resolveCrewsDossierTitle({
      preset: "this_month",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      focusDate: "2026-08-15",
    }).title,
    "Producción Mensual de la Cuadrilla"
  )
  const custom = resolveCrewsDossierTitle({
    preset: "custom",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
    focusDate: "2026-07-31",
  })
  assert.equal(custom.title, "Producción de la Cuadrilla")
  assert.equal(custom.subtitle, "01 Jul → 31 Jul")
})

test("Sprint 27: day journeys group work orders and summarize", () => {
  const journeys = buildCrewsDayJourneys([
    {
      taskId: "t1",
      customerName: "Cliente A",
      status: "finalizada",
      statusLabel: "Finalizada",
      result: "Completada",
      durationMinutes: 40,
      locality: "Centro",
      serviceType: "Instalación",
      zone: "Centro",
      technology: "FTTH",
      customerId: null,
      dueDate: "2026-07-27",
      scheduledTime: "09:00",
      travelFromPreviousMinutes: null,
      travelFromLabel: null,
    },
    {
      taskId: "t2",
      customerName: "Cliente B",
      status: "finalizada",
      statusLabel: "Finalizada",
      result: "Completada",
      durationMinutes: 50,
      locality: "Norte",
      serviceType: "Reparación",
      zone: "Norte",
      technology: "HFC",
      customerId: null,
      dueDate: "2026-07-27",
      scheduledTime: "11:00",
      travelFromPreviousMinutes: 12,
      travelFromLabel: "Cliente A",
    },
    {
      taskId: "t3",
      customerName: "Cliente C",
      status: "asignada",
      statusLabel: "Programada",
      result: "Reprogramada",
      durationMinutes: 0,
      locality: "Sur",
      serviceType: "Visita",
      zone: "Sur",
      technology: "—",
      customerId: null,
      dueDate: "2026-07-28",
      scheduledTime: "10:00",
      travelFromPreviousMinutes: null,
      travelFromLabel: null,
    },
  ])

  assert.equal(journeys.length, 2)
  assert.equal(journeys[0]?.date, "2026-07-28")
  assert.equal(journeys[1]?.date, "2026-07-27")
  assert.equal(journeys[1]?.summary.assignedOt, 2)
  assert.equal(journeys[1]?.summary.finishedOt, 2)
  assert.equal(journeys[1]?.summary.workedMinutes, 90)
  assert.equal(journeys[1]?.workOrders[0]?.taskId, "t1")
  assert.equal(formatCrewsDayHeading("2026-07-27"), "Lunes 27 de Julio")
  assert.equal(formatCrewsWorkedDuration(492), "8 h 12 min")
})

test("Sprint 27: side period summary fields", () => {
  const side = resolveCrewsSidePeriodSummary(
    {
      preset: "last_7_days",
      dateFrom: "2026-07-26",
      dateTo: "2026-08-01",
      focusDate: "2026-08-01",
    },
    {
      assignedOt: 74,
      finishedOt: 67,
      pendingOt: 5,
      cancelledOt: 2,
      rescheduledOt: 1,
      compliance: 91,
      avgMinutesPerOt: 42,
      hoursWorked: 43,
    },
    4
  )
  assert.equal(side.periodLabel, "Últimos 7 días")
  assert.equal(side.assignedOt, 74)
  assert.equal(side.compliance, 91)
  assert.equal(side.incidents, 4)
  assert.equal(side.hoursWorkedLabel, "43 h")
})

test("Sprint 27: presentation-only — no API / React Query changes", () => {
  const dossierUi = readFileSync(
    join(ROOT, "components/activity/crews-dossier-view.tsx"),
    "utf8"
  )
  assert.ok(dossierUi.includes("isCrewsSingleDayPeriod"))
  assert.ok(dossierUi.includes("buildCrewsDayJourneys"))
  assert.ok(dossierUi.includes("CompactWorkOrderCard"))
  assert.ok(dossierUi.includes("TimelineCardInline"))
  assert.ok(dossierUi.includes("Resumen del período"))

  const moduleUi = readFileSync(
    join(ROOT, "components/activity/crews-module.tsx"),
    "utf8"
  )
  assert.ok(moduleUi.includes("CrewsDossierView"))

  const query = readFileSync(
    join(ROOT, "lib/analysis/react-query/use-crews-query.ts"),
    "utf8"
  )
  assert.ok(query.includes("analysisQueryKeys.cuadrillas"))

  const api = readFileSync(
    join(ROOT, "app/api/activity/cuadrillas/route.ts"),
    "utf8"
  )
  assert.ok(api.includes("loadCrewsReadModel"))
})
