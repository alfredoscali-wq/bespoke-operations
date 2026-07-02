import assert from "node:assert/strict"

import {
  FIELD_AGENT_VISIBLE_TASK_STATUSES,
  isFieldAgentVisibleTaskStatus,
} from "../lib/mobile/v1/agenda/field-agent-task-statuses"

assert.deepEqual(FIELD_AGENT_VISIBLE_TASK_STATUSES, ["asignada", "en-curso"])

const visibleStatuses = ["asignada", "en-curso"] as const
for (const status of visibleStatuses) {
  assert.equal(isFieldAgentVisibleTaskStatus(status), true)
}

const hiddenStatuses = [
  "programada",
  "vencida",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
  "finalizada",
  "cerrada",
  "cancelada",
] as const

for (const status of hiddenStatuses) {
  assert.equal(isFieldAgentVisibleTaskStatus(status), false)
}

console.log("field-agent task status filter: OK")
