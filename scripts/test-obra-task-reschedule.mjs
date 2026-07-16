import assert from "node:assert/strict"
import test from "node:test"

import {
  canRescheduleProjectTask,
  canRescheduleProjectTaskFromSession,
  getProjectTaskRescheduleBlockedMessage,
  resolveProjectTaskRescheduleTargetStatus,
} from "../lib/projects/project-task-reschedule.ts"
import { resolveProjectTaskRowActions } from "../lib/projects/project-task-row-actions.ts"
import { canPerformTaskAction } from "../lib/tasks/task-status-workflow.ts"
import { validateTaskRescheduleInput } from "../lib/tasks/reschedule.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"

test("Obra OT asignada/vencida puede reprogramarse; finalizada no", () => {
  assert.equal(
    canRescheduleProjectTask({ projectId: "p1", status: "asignada" }),
    true
  )
  assert.equal(
    canRescheduleProjectTask({ projectId: "p1", status: "vencida" }),
    true
  )
  assert.equal(
    canRescheduleProjectTask({ projectId: "p1", status: "programada" }),
    true
  )
  assert.equal(
    canRescheduleProjectTask({ projectId: "p1", status: "finalizada" }),
    false
  )
  assert.equal(
    canRescheduleProjectTask({ projectId: null, status: "asignada" }),
    false
  )
})

test("Target status: vencida con cuadrilla → asignada; asignada se mantiene", () => {
  assert.equal(
    resolveProjectTaskRescheduleTargetStatus({
      status: "vencida",
      crewId: "crew-1",
      crew: "Cuadrilla 1",
    }),
    "asignada"
  )
  assert.equal(
    resolveProjectTaskRescheduleTargetStatus({
      status: "asignada",
      crewId: "crew-1",
      crew: "Cuadrilla 1",
    }),
    "asignada"
  )
  assert.equal(
    resolveProjectTaskRescheduleTargetStatus({
      status: "programada",
      crewId: null,
      crew: "",
    }),
    "programada"
  )
  assert.equal(
    resolveProjectTaskRescheduleTargetStatus({
      status: "vencida",
      crewId: null,
      crew: "",
    }),
    "programada"
  )
})

test("Permiso Obras: módulo projects; no requiere admin", () => {
  const obrasUser = {
    systemRole: "supervisor",
    roleCode: "sup",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      projects: true,
    },
  }

  const noObrasUser = {
    systemRole: "operario",
    roleCode: "op",
    moduleVisibility: createEmptyModuleVisibility(),
  }

  assert.equal(
    canRescheduleProjectTaskFromSession(obrasUser, {
      projectId: "p1",
      status: "vencida",
    }),
    true
  )
  assert.equal(
    canRescheduleProjectTaskFromSession(noObrasUser, {
      projectId: "p1",
      status: "vencida",
    }),
    false
  )
  assert.equal(
    canRescheduleProjectTaskFromSession(
      {
        systemRole: "administrador",
        roleCode: "admin",
        moduleVisibility: createFullModuleVisibility(),
      },
      { projectId: "p1", status: "asignada" }
    ),
    true
  )
})

test("Row actions expone showReschedule para OT de obra reprogramable", () => {
  const actions = resolveProjectTaskRowActions({
    projectId: "p1",
    status: "vencida",
    progress: 0,
    completedAt: null,
    closedAt: null,
    operationalSteps: [],
  })
  assert.equal(actions.showReschedule, true)

  const finalized = resolveProjectTaskRowActions({
    projectId: "p1",
    status: "finalizada",
    progress: 100,
    completedAt: "2026-07-01",
    closedAt: null,
    operationalSteps: [],
  })
  assert.equal(finalized.showReschedule, false)
})

test("Workflow reschedule-obra permitido desde asignada y vencida", () => {
  assert.equal(
    canPerformTaskAction(
      /** @type {any} */ ({ status: "asignada" }),
      "reschedule-obra"
    ).allowed,
    true
  )
  assert.equal(
    canPerformTaskAction(
      /** @type {any} */ ({ status: "vencida" }),
      "reschedule-obra"
    ).allowed,
    true
  )
  assert.equal(
    canPerformTaskAction(
      /** @type {any} */ ({ status: "finalizada" }),
      "reschedule-obra"
    ).allowed,
    false
  )
})

test("Motivo vacío bloquea la reprogramación", () => {
  const result = validateTaskRescheduleInput({
    dueDate: "2026-07-20",
    scheduledTime: "10:00",
    reason: "   ",
  })
  assert.equal(result.allowed, false)
  assert.match(result.message ?? "", /motivo/i)
})

test("Mensaje bloqueo finalizada", () => {
  assert.match(
    getProjectTaskRescheduleBlockedMessage({
      projectId: "p1",
      status: "finalizada",
    }) ?? "",
    /finalizada/i
  )
})
