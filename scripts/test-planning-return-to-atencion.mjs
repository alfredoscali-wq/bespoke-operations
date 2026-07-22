import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  buildPlanningReturnToAtencionUpdate,
  canReturnPlanningTaskToAtencion,
  countPlanningReturnedTasks,
  excludePlanningReturnedTasks,
  filterPlanningReturnedTasks,
  hasActivePlanningReturn,
  PLANNING_RETURNED_DISPLAY_LABEL,
  readPlanningReturnInfo,
  resolvePlanningReturnDisplayLabel,
  shouldClearPlanningReturnOnScheduleUpdate,
  validatePlanningReturnReason,
} from "../lib/tasks/planning-return.ts"
import { resolveOperationalExecutionBadge } from "../lib/tasks/operational-category.ts"
import { isOperationallyOverdueTask } from "../lib/tasks/operational-overdue.ts"
import { resolveTaskRowSurfaceTone } from "../lib/tasks/status-visual.ts"
import { isTaskVencida, shouldAutoTransitionToVencida } from "../lib/tasks/vencida-status.ts"
import { canPerformTaskAction } from "../lib/tasks/task-status-workflow.ts"
import {
  canSoftDeleteWorkOrder,
  resolveWorkOrderRowMenuPolicy,
} from "../lib/tasks/work-order-deletion-policy.ts"
import { canAdminModifyWorkOrderTask } from "../lib/tasks/work-order-admin-mutation.ts"
import { isCriticalPendingTask } from "../lib/calendar/critical-pending.ts"

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

test("OT devuelta no se mezcla con el listado activo ni aparece como vencida", () => {
  const returned = {
    ...baseTask,
    id: "task-returned",
    status: "vencida",
    dueDate: "2026-07-01",
    taskMetadata: buildPlanningReturnToAtencionUpdate(baseTask, {
      reason: "Cliente solicita otra fecha",
      returnedBy: "Supervisor Demo",
    }).taskMetadata,
  }
  const regular = { ...baseTask, id: "task-regular", taskMetadata: {} }

  assert.deepEqual(
    excludePlanningReturnedTasks([returned, regular]).map((task) => task.id),
    ["task-regular"]
  )
  assert.equal(resolvePlanningReturnDisplayLabel(returned), PLANNING_RETURNED_DISPLAY_LABEL)
  assert.equal(resolveOperationalExecutionBadge(returned).label, "Devuelta")
  assert.equal(resolveTaskRowSurfaceTone(returned), "amber")
  assert.equal(
    resolveTaskRowSurfaceTone({
      ...returned,
      status: "programada",
    }),
    "amber"
  )
  assert.equal(isOperationallyOverdueTask(returned), false)
  assert.equal(shouldAutoTransitionToVencida(returned), false)
  assert.equal(isTaskVencida(returned), false)
  assert.equal(isCriticalPendingTask(returned), false)
  assert.equal(
    canPerformTaskAction(returned, "reschedule-planning-return").allowed,
    true
  )
})

test("OT devuelta por planificación no permite soft-delete", () => {
  const returnedProgramada = {
    status: "programada",
    taskMetadata: buildPlanningReturnToAtencionUpdate(baseTask, {
      reason: "Material",
      returnedBy: "Supervisor",
    }).taskMetadata,
  }
  const returnedVencida = {
    ...returnedProgramada,
    status: "vencida",
  }
  const regularProgramada = { status: "programada", taskMetadata: {} }

  assert.equal(canSoftDeleteWorkOrder(returnedProgramada), false)
  assert.equal(canSoftDeleteWorkOrder(returnedVencida), false)
  assert.equal(canSoftDeleteWorkOrder(regularProgramada), true)
  assert.equal(canSoftDeleteWorkOrder("programada"), true)
})

test("bandeja Devueltas: menú solo Ver detalle; sin editar ni eliminar", () => {
  const returned = {
    status: "programada",
    taskMetadata: buildPlanningReturnToAtencionUpdate(baseTask, {
      reason: "Material",
      returnedBy: "Supervisor",
    }).taskMetadata,
  }
  const regular = { status: "programada", taskMetadata: {} }

  const returnedPolicy = resolveWorkOrderRowMenuPolicy(returned)
  assert.equal(returnedPolicy.showView, true)
  assert.equal(returnedPolicy.showEdit, false)
  assert.equal(returnedPolicy.showSoftDelete, false)
  assert.equal(returnedPolicy.showAssignCrew, false)
  assert.equal(canAdminModifyWorkOrderTask(returned), false)

  const regularPolicy = resolveWorkOrderRowMenuPolicy(regular)
  assert.equal(regularPolicy.showEdit, true)
  assert.equal(regularPolicy.showSoftDelete, true)
  assert.equal(canAdminModifyWorkOrderTask(regular), true)
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
  const rowActions = readFileSync(
    resolve(root, "components/tareas/task-admin-row-actions.tsx"),
    "utf8"
  )
  const returnPanel = readFileSync(
    resolve(root, "components/tareas/task-planning-return-record-panel.tsx"),
    "utf8"
  )

  assert.match(planningRow, /Devolver a Atención/)
  assert.match(tasksModule, /TasksPlanningReturnedKpi/)
  assert.match(tasksModule, /planningReturned/)
  assert.match(tasksModule, /excludePlanningReturnedTasks/)
  assert.match(rowActions, /Reprogramar/)
  assert.match(rowActions, /isPlanningReturnTray/)
  assert.match(returnPanel, /Reprogramar/)
})
