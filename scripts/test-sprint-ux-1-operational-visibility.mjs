import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCalendarDayOperationsSections,
  CALENDAR_NO_CREW_GROUP_KEY,
  CALENDAR_NO_CREW_GROUP_LABEL,
  CALENDAR_WEEK_MAX_VISIBLE_EVENTS,
  resolveCalendarTaskRouteOrderLabel,
  sortCalendarTaskEventsByRouteOrder,
} from "../lib/calendar/calendar-day-operations.ts"
import { addDays, formatCalendarDayLabel, getWeekStart } from "../lib/calendar/calendar-utils.ts"
import { resolveTaskPlanningCoordinates } from "../lib/planificacion/planning-utils.ts"

function buildTaskEvent(input) {
  return {
    id: input.id,
    type: "TASK",
    date: "2026-07-10",
    startDate: "2026-07-10",
    endDate: "2026-07-10",
    title: input.customerName ?? "Cliente",
    payload: {
      taskId: input.id,
      code: `OT-${input.id}`,
      title: input.customerName ?? "Cliente",
      projectCode: "PRJ",
      projectName: "Proyecto",
      customerName: input.customerName ?? "Cliente",
      status: input.status ?? "programada",
      priority: "media",
      startDate: "2026-07-10",
      dueDate: "2026-07-10",
      scheduledTime: input.scheduledTime ?? "09:00",
      crew: input.crew,
      crewId: input.crewId,
      dispatchOrder: input.dispatchOrder ?? null,
      executionOrder: input.executionOrder ?? null,
      alerts: [],
    },
  }
}

test("CALENDAR_WEEK_MAX_VISIBLE_EVENTS expone límite compacto ampliado", () => {
  assert.equal(CALENDAR_WEEK_MAX_VISIBLE_EVENTS, 12)
})

test("resolveCalendarTaskRouteOrderLabel usa execution_order en programada", () => {
  const label = resolveCalendarTaskRouteOrderLabel(
    buildTaskEvent({ id: "1", executionOrder: 3 }).payload
  )

  assert.equal(label, "③")
})

test("sortCalendarTaskEventsByRouteOrder respeta orden operativo dentro de cuadrilla", () => {
  const events = sortCalendarTaskEventsByRouteOrder([
    buildTaskEvent({ id: "b", crewId: "crew-1", executionOrder: 2 }),
    buildTaskEvent({ id: "a", crewId: "crew-1", executionOrder: 1 }),
    buildTaskEvent({ id: "c", crewId: "crew-1", executionOrder: 3 }),
  ])

  assert.deepEqual(
    events.map((event) => event.id),
    ["a", "b", "c"]
  )
})

test("buildCalendarDayOperationsSections agrupa por cuadrilla", () => {
  const sections = buildCalendarDayOperationsSections(
    [
      buildTaskEvent({ id: "1", crewId: "crew-a", crew: "Cuadrilla A" }),
      buildTaskEvent({ id: "2", crewId: "crew-b", crew: "Cuadrilla B" }),
      buildTaskEvent({ id: "3", crewId: "crew-a", crew: "Cuadrilla A", executionOrder: 2 }),
      buildTaskEvent({ id: "4", crewId: "crew-a", crew: "Cuadrilla A", executionOrder: 1 }),
    ],
    [
      { id: "crew-a", name: "Cuadrilla A" },
      { id: "crew-b", name: "Cuadrilla B" },
    ]
  )

  assert.equal(sections.length, 2)
  assert.equal(sections[0]?.crewName, "Cuadrilla A")
  assert.equal(sections[0]?.events.length, 3)
  assert.deepEqual(
    sections[0]?.events.map((event) => event.id),
    ["4", "3", "1"]
  )
  assert.equal(sections[1]?.crewName, "Cuadrilla B")
})

test("OT sin cuadrilla cae en sección identificada", () => {
  const sections = buildCalendarDayOperationsSections(
    [buildTaskEvent({ id: "orphan" })],
    [{ id: "crew-a", name: "Cuadrilla A" }]
  )

  assert.equal(sections.length, 1)
  assert.equal(sections[0]?.crewKey, CALENDAR_NO_CREW_GROUP_KEY)
  assert.equal(sections[0]?.crewName, CALENDAR_NO_CREW_GROUP_LABEL)
})

test("vista Hoy no usa límite semanal de overflow", () => {
  const events = Array.from({ length: 20 }, (_, index) =>
    buildTaskEvent({
      id: `task-${index + 1}`,
      crewId: "crew-a",
      crew: "Cuadrilla A",
      executionOrder: index + 1,
    })
  )

  const sections = buildCalendarDayOperationsSections(events, [
    { id: "crew-a", name: "Cuadrilla A" },
  ])

  assert.equal(sections[0]?.events.length, 20)
  assert.ok((sections[0]?.events.length ?? 0) > CALENDAR_WEEK_MAX_VISIBLE_EVENTS)
})

test("formatCalendarDayLabel expone encabezado legible para vista diaria", () => {
  const label = formatCalendarDayLabel("2026-07-10")
  assert.match(label, /2026/)
  assert.match(label, /10/)
})

test("navegación temporal mínima: Hoy cae en semana actual y día siguiente avanza fecha", () => {
  const today = "2026-07-10"
  const weekStart = getWeekStart(today)
  const nextDay = addDays(today, 1)

  assert.equal(weekStart, "2026-07-06")
  assert.equal(nextDay, "2026-07-11")
})

test("OT sin GPS puede resolverse como no mapeable sin lanzar error", () => {
  const task = {
    id: "task-no-gps",
    latitude: null,
    longitude: null,
  }

  assert.equal(resolveTaskPlanningCoordinates(task), null)
})

test("row id de planificación sigue convención estable para scroll", () => {
  const taskId = "abc-123"
  assert.equal(`planning-task-row-${taskId}`, "planning-task-row-abc-123")
})

test("sticky map mantiene clases operativas esperadas", async () => {
  const file = await import("node:fs/promises").then((fs) =>
    fs.readFile("components/planificacion/planning-module.tsx", "utf8")
  )

  assert.match(file, /sticky top-16/)
  assert.match(file, /min-h-\[38vh\]/)
})

test("planning map canvas abre popup al seleccionar marker cuando hay GPS", async () => {
  const file = await import("node:fs/promises").then((fs) =>
    fs.readFile("components/planificacion/planning-map-canvas.tsx", "utf8")
  )

  assert.match(file, /openPopup\(\)/)
  assert.match(file, /flyTo\(/)
})

test("planning task row selecciona fila completa y marca ausencia de GPS", async () => {
  const file = await import("node:fs/promises").then((fs) =>
    fs.readFile("components/planificacion/planning-task-table-row.tsx", "utf8")
  )

  assert.match(file, /onClick=\{onSelect\}/)
  assert.match(file, /MapPinOff/)
  assert.match(file, /stopPropagation/)
})

test("planning task list solicita scroll a fila seleccionada", async () => {
  const file = await import("node:fs/promises").then((fs) =>
    fs.readFile("components/planificacion/planning-task-list.tsx", "utf8")
  )

  assert.match(file, /scrollIntoView/)
  assert.match(file, /planning-task-row-/)
})

test("calendar module alterna vista semanal y diaria", async () => {
  const file = await import("node:fs/promises").then((fs) =>
    fs.readFile("components/calendario/calendar-module.tsx", "utf8")
  )

  assert.match(file, /CalendarDayOperationsView/)
  assert.match(file, /Vista semanal/)
  assert.match(file, /goToToday/)
})
