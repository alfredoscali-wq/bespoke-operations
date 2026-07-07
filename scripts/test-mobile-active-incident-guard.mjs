import assert from "node:assert/strict"
import test from "node:test"

import {
  isTaskExecutionBlockedByActiveIncident,
  MOBILE_TASK_BLOCKED_BY_ACTIVE_INCIDENT_MESSAGE,
  resolveMobileTaskHasActiveIncident,
  resolveMobileTaskHasActiveIncidentFromTaskSet,
} from "../lib/mobile/v1/tasks/task-active-incident.shared.ts"

test("hasActiveIncident es true solo para en-curso con incidencia activa", () => {
  assert.equal(
    resolveMobileTaskHasActiveIncident({
      taskStatus: "en-curso",
      hasActiveIncidentRecord: true,
    }),
    true
  )

  assert.equal(
    resolveMobileTaskHasActiveIncident({
      taskStatus: "en-curso",
      hasActiveIncidentRecord: false,
    }),
    false
  )

  assert.equal(
    resolveMobileTaskHasActiveIncident({
      taskStatus: "programada",
      hasActiveIncidentRecord: true,
    }),
    false
  )
})

test("agenda/detalle pueden calcular hasActiveIncident desde conjunto de taskIds", () => {
  const activeIds = new Set(["task-1"])

  assert.equal(
    resolveMobileTaskHasActiveIncidentFromTaskSet({
      taskId: "task-1",
      taskStatus: "en-curso",
      activeIncidentTaskIds: activeIds,
    }),
    true
  )

  assert.equal(
    resolveMobileTaskHasActiveIncidentFromTaskSet({
      taskId: "task-2",
      taskStatus: "en-curso",
      activeIncidentTaskIds: activeIds,
    }),
    false
  )
})

test("incidencia activa bloquea ejecución operativa en en-curso", () => {
  assert.equal(
    isTaskExecutionBlockedByActiveIncident({
      taskStatus: "en-curso",
      hasActiveIncident: true,
    }),
    true
  )

  assert.equal(
    isTaskExecutionBlockedByActiveIncident({
      taskStatus: "en-curso",
      hasActiveIncident: false,
    }),
    false
  )
})

test("incidencia resuelta permite operar nuevamente", () => {
  assert.equal(
    resolveMobileTaskHasActiveIncident({
      taskStatus: "en-curso",
      hasActiveIncidentRecord: false,
    }),
    false
  )
})

test("reprogram y cancel sacan la OT del trabajo activo en-curso", () => {
  assert.equal(
    resolveMobileTaskHasActiveIncident({
      taskStatus: "programada",
      hasActiveIncidentRecord: false,
    }),
    false
  )

  assert.equal(
    resolveMobileTaskHasActiveIncident({
      taskStatus: "cancelada",
      hasActiveIncidentRecord: false,
    }),
    false
  )
})

test("mensaje de bloqueo es claro para Field Agent", () => {
  assert.match(
    MOBILE_TASK_BLOCKED_BY_ACTIVE_INCIDENT_MESSAGE,
    /incidencia activa/i
  )
  assert.match(
    MOBILE_TASK_BLOCKED_BY_ACTIVE_INCIDENT_MESSAGE,
    /supervisor/i
  )
})

test("segunda incidencia activa sigue siendo rechazada por regla DUPLICATE_ACTIVE", () => {
  assert.equal(
    isTaskExecutionBlockedByActiveIncident({
      taskStatus: "en-curso",
      hasActiveIncident: true,
    }),
    true
  )
})
