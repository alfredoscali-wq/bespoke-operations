import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  buildPlanningReturnToAtencionUpdate,
  canReturnPlanningTaskToAtencion,
  countPlanningReturnedTasks,
  filterPlanningReturnedTasks,
  hasActivePlanningReturn,
  readPlanningReturnInfo,
  shouldClearPlanningReturnOnScheduleUpdate,
  validatePlanningReturnReason,
} from "../lib/tasks/planning-return.ts"
import { canPerformTaskAction } from "../lib/tasks/task-status-workflow.ts"

const root = resolve(import.meta.dirname, "..")

const baseTask = {
  id: "task-1",
  code: "OT-001",
  title: "Instalación",
  description: "",
  projectCode: "OT",
  projectName: "SERVICIO",
  type: "fiber",
  status: "asignada",
  priority: "media",
  supervisor: "Juan",
  crew: "Cuadrilla A",
  crewId: "crew-1",
  startDate: "2026-07-01",
  dueDate: "2026-07-16",
  scheduledTime: "09:00:00",
  estimatedDuration: "60 min",
  checklist: [],
  progress: 0,
  serviceType: "instalacion-nueva",
  dispatchOrder: 2,
  executionOrder: null,
}

test("solo permite devolver OT no iniciadas", () => {
  assert.equal(canReturnPlanningTaskToAtencion(baseTask), true)
  assert.equal(
    canReturnPlanningTaskToAtencion({ ...baseTask, status: "en-curso" }),
    false
  )
  assert.equal(
    canReturnPlanningTaskToAtencion({ ...baseTask, status: "finalizada" }),
    false
  )
})

test("motivo de devolución es obligatorio", () => {
  assert.equal(validatePlanningReturnReason("").allowed, false)
  assert.equal(validatePlanningReturnReason("Falta de materiales").allowed, true)
})

test("buildPlanningReturnToAtencionUpdate limpia programación y conserva datos", () => {
  const update = buildPlanningReturnToAtencionUpdate(baseTask, {
    reason: "Falta de materiales",
    returnedBy: "Supervisor Demo",
  })

  assert.equal(update.status, "programada")
  assert.equal(update.crewId, null)
  assert.equal(update.crew, "")
  assert.equal(update.dueDate, "2026-07-01")
  assert.equal(update.scheduledTime, null)
  assert.equal(update.dispatchOrder, null)
  assert.equal(update.executionOrder, null)

  const info = readPlanningReturnInfo({
    taskMetadata: update.taskMetadata,
  })
  assert.equal(info?.reason, "Falta de materiales")
  assert.equal(info?.returnedBy, "Supervisor Demo")
  assert.equal(info?.previousCrewName, "Cuadrilla A")
  assert.equal(info?.previousDueDate, "2026-07-16")
})

test("workflow return-to-atencion habilita asignada → programada", () => {
  const validation = canPerformTaskAction(baseTask, "return-to-atencion")
  assert.equal(validation.allowed, true)
})

test("KPI y filtro de devueltas por planificación", () => {
  const returned = {
    ...baseTask,
    status: "programada",
    crew: "",
    crewId: undefined,
    dueDate: "2026-07-01",
    taskMetadata: buildPlanningReturnToAtencionUpdate(baseTask, {
      reason: "Cliente solicita otra fecha",
      returnedBy: "Supervisor Demo",
    }).taskMetadata,
  }
  const regular = { ...baseTask, taskMetadata: {} }

  assert.equal(hasActivePlanningReturn(returned), true)
  assert.equal(hasActivePlanningReturn(regular), false)
  assert.equal(countPlanningReturnedTasks([returned, regular]), 1)
  assert.deepEqual(filterPlanningReturnedTasks([returned, regular]).map((t) => t.id), [
    "task-1",
  ])
})

test("limpia indicador al reprogramar con nueva fecha", () => {
  const task = {
    ...baseTask,
    taskMetadata: buildPlanningReturnToAtencionUpdate(baseTask, {
      reason: "Material",
      returnedBy: "Supervisor",
    }).taskMetadata,
  }

  assert.equal(
    shouldClearPlanningReturnOnScheduleUpdate(task, "2026-07-20"),
    true
  )
  assert.equal(
    shouldClearPlanningReturnOnScheduleUpdate(task, "2026-07-01"),
    false
  )
})

test("UI expone acción Devolver a Atención en planificación y KPI en tareas", () => {
  const planningRow = readFileSync(
    resolve(root, "components/planificacion/planning-task-table-row.tsx"),
    "utf8"
  )
  const tasksModule = readFileSync(
    resolve(root, "components/tareas/tasks-module.tsx"),
    "utf8"
  )

  assert.match(planningRow, /Devolver a Atención/)
  assert.match(tasksModule, /TasksPlanningReturnedKpi/)
  assert.match(tasksModule, /planningReturned/)
})
