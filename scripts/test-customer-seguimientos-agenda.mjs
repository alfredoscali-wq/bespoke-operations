import assert from "node:assert/strict"
import test from "node:test"

import {
  enrichAgendaRowOverdue,
  filterAgendaForTodayView,
  filterAgendaForWeekView,
  groupAgendaWeekItems,
  isSeguimientoOverdue,
  sortAgendaTodayItems,
  toDateKey,
} from "../lib/customer-seguimientos/agenda.ts"

const referenceDate = new Date(2026, 6, 8, 12, 0, 0)

function buildItem(overrides) {
  return enrichAgendaRowOverdue(
    {
      id: overrides.id ?? "item-1",
      customerId: "customer-1",
      sourceAtencionId: "atencion-1",
      scheduledDate: overrides.scheduledDate ?? "2026-07-08",
      scheduledTime: overrides.scheduledTime ?? null,
      observation: overrides.observation ?? "Observación",
      status: "pendiente",
      customerName: overrides.customerName ?? "Cliente",
    },
    referenceDate
  )
}

test("detecta seguimiento vencido solo si está pendiente y la fecha es anterior", () => {
  assert.equal(
    isSeguimientoOverdue(
      { scheduledDate: "2026-07-07", status: "pendiente" },
      referenceDate
    ),
    true
  )
  assert.equal(
    isSeguimientoOverdue(
      { scheduledDate: "2026-07-07", status: "completado" },
      referenceDate
    ),
    false
  )
})

test("agenda hoy ordena vencidos, con horario y sin horario", () => {
  const groups = sortAgendaTodayItems([
    buildItem({
      id: "late-no-time",
      scheduledDate: "2026-07-07",
      scheduledTime: null,
      customerName: "Zeta",
    }),
    buildItem({
      id: "today-no-time",
      scheduledDate: "2026-07-08",
      scheduledTime: null,
      customerName: "Ana",
    }),
    buildItem({
      id: "today-11",
      scheduledDate: "2026-07-08",
      scheduledTime: "11:00",
      customerName: "Bruno",
    }),
    buildItem({
      id: "today-09",
      scheduledDate: "2026-07-08",
      scheduledTime: "09:00",
      customerName: "Carlos",
    }),
  ])

  assert.equal(groups.overdue.length, 1)
  assert.deepEqual(
    groups.scheduled.map((item) => item.id),
    ["today-09", "today-11"]
  )
  assert.equal(groups.unscheduled.length, 1)
})

test("agenda semana agrupa por día e incluye vencidos", () => {
  const items = [
    buildItem({
      id: "overdue",
      scheduledDate: "2026-07-06",
      customerName: "Vencido",
    }),
    buildItem({
      id: "wednesday",
      scheduledDate: "2026-07-09",
      scheduledTime: "10:30",
      customerName: "Miércoles",
    }),
  ]

  const week = groupAgendaWeekItems(
    filterAgendaForWeekView(items, referenceDate),
    referenceDate
  )

  assert.equal(week.overdue.length, 1)
  assert.equal(week.days.length, 7)
  assert.equal(
    week.days.find((day) => day.dateKey === "2026-07-09")?.items[0]?.id,
    "wednesday"
  )
})

test("filtro hoy incluye vencidos y gestiones del día actual", () => {
  const items = [
    buildItem({ id: "overdue", scheduledDate: "2026-07-06" }),
    buildItem({ id: "today", scheduledDate: toDateKey(referenceDate) }),
    buildItem({ id: "tomorrow", scheduledDate: "2026-07-09" }),
  ]

  const filtered = filterAgendaForTodayView(items, referenceDate)
  assert.deepEqual(
    filtered.map((item) => item.id).sort(),
    ["overdue", "today"]
  )
})
