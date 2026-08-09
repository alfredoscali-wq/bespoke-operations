import assert from "node:assert/strict"

import {
  FIELD_AGENT_AGENDA_QUERY_STATUSES,
  isFieldAgentAgendaTaskVisible,
} from "../lib/mobile/v1/agenda/agenda-task-visibility"
import {
  FIELD_AGENT_VISIBLE_TASK_STATUSES,
  isFieldAgentVisibleTaskStatus,
} from "../lib/mobile/v1/agenda/field-agent-task-statuses"

assert.deepEqual(FIELD_AGENT_VISIBLE_TASK_STATUSES, FIELD_AGENT_AGENDA_QUERY_STATUSES)

const visibleStatuses = [
  "asignada",
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
  "vencida",
] as const

for (const status of visibleStatuses) {
  assert.equal(isFieldAgentVisibleTaskStatus(status), true)
}

assert.equal(
  isFieldAgentAgendaTaskVisible(
    { status: "en-curso", dueDate: "2020-01-01" },
    "2026-07-04"
  ),
  true
)

assert.equal(
  isFieldAgentAgendaTaskVisible(
    { status: "asignada", startDate: "2026-07-04", dueDate: "2026-07-04" },
    "2026-07-04"
  ),
  true
)

assert.equal(
  isFieldAgentAgendaTaskVisible(
    { status: "asignada", startDate: "2026-07-10", dueDate: "2026-07-10" },
    "2026-07-04"
  ),
  false
)

assert.equal(
  isFieldAgentAgendaTaskVisible(
    { status: "asignada", startDate: "2026-07-04", dueDate: "2026-07-10" },
    "2026-07-04"
  ),
  true,
  "multi-day OT visible on start date"
)

assert.equal(
  isFieldAgentAgendaTaskVisible(
    { status: "asignada", startDate: "2026-07-04", dueDate: "2026-07-10" },
    "2026-07-07"
  ),
  true,
  "multi-day OT visible mid-range"
)

assert.equal(
  isFieldAgentAgendaTaskVisible(
    { status: "asignada", startDate: "2026-07-04", dueDate: "2026-07-10" },
    "2026-07-11"
  ),
  false,
  "multi-day OT hidden after end date"
)

const hiddenStatuses = [
  "programada",
  "finalizada",
  "cerrada",
  "cancelada",
] as const

for (const status of hiddenStatuses) {
  assert.equal(isFieldAgentVisibleTaskStatus(status), false)
}

console.log("field-agent task status filter: OK")
