import assert from "node:assert/strict"
import test from "node:test"

import {
  buildSupervisorRescheduleActiveTaskPlan,
  buildTaskMetadataAfterOperationalChecklistReset,
  describeSupervisorRescheduleOperationalOrders,
  validateSupervisorRescheduleActiveTaskPreconditions,
} from "../lib/operations/incidents/supervisor-reschedule-active-task-plan.ts"
import { OPERATIONAL_CHECKLIST_RESPONSES_KEY } from "../lib/tasks/operational-checklist-responses.ts"

const CREW_A = { id: "crew-a", name: "Cuadrilla A" }
const CREW_B = { id: "crew-b", name: "Cuadrilla B" }

function buildTask(overrides = {}) {
  return {
    id: "task-1",
    code: "OT-1",
    title: "Instalación",
    description: "",
    projectCode: "P1",
    projectName: "Proyecto",
    type: "instalacion",
    priority: "media",
    status: "en-curso",
    dueDate: "2026-07-10",
    startDate: "2026-07-10",
    scheduledTime: "09:00:00",
    crewId: CREW_A.id,
    crew: CREW_A.name,
    dispatchOrder: 2,
    executionOrder: null,
    taskMetadata: {
      [OPERATIONAL_CHECKLIST_RESPONSES_KEY]: {
        item1: { confirmed: true },
      },
      preservedFlag: true,
    },
    createdAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  }
}

function buildIncident(overrides = {}) {
  return {
    id: "incident-1",
    companyId: "company-a",
    taskId: "task-1",
    status: "EN_ANALISIS",
    ...overrides,
  }
}

test("validateSupervisorRescheduleActiveTaskPreconditions autoriza en-curso + incidencia activa", () => {
  const result = validateSupervisorRescheduleActiveTaskPreconditions({
    canSupervise: true,
    task: buildTask(),
    incident: buildIncident(),
    companyId: "company-a",
    crew: CREW_A,
  })

  assert.equal(result.ok, true)
})

test("validateSupervisorRescheduleActiveTaskPreconditions rechaza usuario sin permisos", () => {
  const result = validateSupervisorRescheduleActiveTaskPreconditions({
    canSupervise: false,
    task: buildTask(),
    incident: buildIncident(),
    companyId: "company-a",
    crew: CREW_A,
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "FORBIDDEN")
  }
})

test("validateSupervisorRescheduleActiveTaskPreconditions rechaza incidencia de otro tenant", () => {
  const result = validateSupervisorRescheduleActiveTaskPreconditions({
    canSupervise: true,
    task: buildTask(),
    incident: buildIncident({ companyId: "company-b" }),
    companyId: "company-a",
    crew: CREW_A,
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "INVALID_INCIDENT")
  }
})

test("validateSupervisorRescheduleActiveTaskPreconditions rechaza incidencia cerrada", () => {
  const result = validateSupervisorRescheduleActiveTaskPreconditions({
    canSupervise: true,
    task: buildTask(),
    incident: buildIncident({ status: "RESUELTA" }),
    companyId: "company-a",
    crew: CREW_A,
  })

  assert.equal(result.ok, false)
})

test("validateSupervisorRescheduleActiveTaskPreconditions rechaza incidencia no relacionada", () => {
  const result = validateSupervisorRescheduleActiveTaskPreconditions({
    canSupervise: true,
    task: buildTask(),
    incident: buildIncident({ taskId: "other-task" }),
    companyId: "company-a",
    crew: CREW_A,
  })

  assert.equal(result.ok, false)
})

test("validateSupervisorRescheduleActiveTaskPreconditions rechaza OT distinta de en-curso", () => {
  const result = validateSupervisorRescheduleActiveTaskPreconditions({
    canSupervise: true,
    task: buildTask({ status: "asignada" }),
    incident: buildIncident(),
    companyId: "company-a",
    crew: CREW_A,
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "INVALID_STATUS")
  }
})

test("validateSupervisorRescheduleActiveTaskPreconditions rechaza cuadrilla inexistente", () => {
  const result = validateSupervisorRescheduleActiveTaskPreconditions({
    canSupervise: true,
    task: buildTask(),
    incident: buildIncident(),
    companyId: "company-a",
    crew: null,
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "INVALID_CREW")
  }
})

test("buildTaskMetadataAfterOperationalChecklistReset elimina respuestas y preserva metadata", () => {
  const metadata = buildTaskMetadataAfterOperationalChecklistReset(buildTask())

  assert.equal(metadata.preservedFlag, true)
  assert.equal(metadata[OPERATIONAL_CHECKLIST_RESPONSES_KEY], undefined)
})

test("buildSupervisorRescheduleActiveTaskPlan resetea checklist parcial y completado", () => {
  for (const responses of [
    { item1: { confirmed: true } },
    { item1: { confirmed: true }, item2: { textValue: "ok" } },
    {},
  ]) {
    const plan = buildSupervisorRescheduleActiveTaskPlan({
      task: buildTask({
        taskMetadata: {
          [OPERATIONAL_CHECKLIST_RESPONSES_KEY]: responses,
          preservedFlag: true,
        },
      }),
      allTasks: [buildTask()],
      rescheduleInput: {
        dueDate: "2026-07-10",
        scheduledTime: "10:00",
        reason: "cliente-solicito",
        rescheduledBy: "Supervisor",
        crewId: CREW_A.id,
        crew: CREW_A.name,
      },
      crews: [CREW_A],
      referenceDate: new Date("2026-07-01T12:00:00.000Z"),
    })

    assert.equal("ok" in plan, false)
    assert.equal(plan.taskMetadata[OPERATIONAL_CHECKLIST_RESPONSES_KEY], undefined)
    assert.equal(plan.taskMetadata.preservedFlag, true)
  }
})

test("buildSupervisorRescheduleActiveTaskPlan aplica cuatro escenarios operativos", () => {
  const scenarios = [
    {
      name: "same-date-same-crew",
      dueDate: "2026-07-10",
      crewId: CREW_A.id,
    },
    {
      name: "new-date-same-crew",
      dueDate: "2026-07-12",
      crewId: CREW_A.id,
    },
    {
      name: "same-date-new-crew",
      dueDate: "2026-07-10",
      crewId: CREW_B.id,
    },
    {
      name: "new-date-new-crew",
      dueDate: "2026-07-15",
      crewId: CREW_B.id,
    },
  ]

  for (const scenario of scenarios) {
    const task = buildTask()
    const allTasks = [
      task,
      buildTask({
        id: "task-2",
        dispatchOrder: 1,
        status: "en-curso",
      }),
    ]

    const plan = buildSupervisorRescheduleActiveTaskPlan({
      task,
      allTasks,
      rescheduleInput: {
        dueDate: scenario.dueDate,
        scheduledTime: "11:00",
        reason: "conflicto-agenda",
        rescheduledBy: "Supervisor",
        crewId: scenario.crewId,
        crew: scenario.crewId === CREW_A.id ? CREW_A.name : CREW_B.name,
      },
      crews: [CREW_A, CREW_B],
      referenceDate: new Date("2026-07-01T12:00:00.000Z"),
    })

    assert.equal("ok" in plan, false)
    assert.equal(plan.targetStatus, "asignada")
    assert.equal(plan.taskPayload.executionOrder, null)
    assert.equal(plan.taskPayload.dispatchOrder, null)
    assert.equal(plan.taskPayload.dueDate, scenario.dueDate)
    assert.equal(plan.taskPayload.crewId, scenario.crewId)
    assert.deepEqual(plan.preDispatchClears, [
      { task_id: "task-1", dispatch_order: null },
    ])

    const described = describeSupervisorRescheduleOperationalOrders({
      originDueDate: task.dueDate,
      originCrewId: CREW_A.id,
      destinationDueDate: scenario.dueDate,
      destinationCrewId: scenario.crewId,
      preDispatchClears: plan.preDispatchClears,
      postDispatchAssignments: plan.postDispatchAssignments,
    })

    assert.equal(described.scenario, scenario.name)
    assert.equal(described.executionOrder, null)
    assert.ok(described.dispatchOrder != null)
  }
})

test("buildSupervisorRescheduleActiveTaskPlan conserva trazabilidad de replanificación", () => {
  const plan = buildSupervisorRescheduleActiveTaskPlan({
    task: buildTask(),
    allTasks: [buildTask()],
    rescheduleInput: {
      dueDate: "2026-07-11",
      scheduledTime: "08:30",
      reason: "material-no-disponible",
      notes: "Reprogramada por incidencia",
      rescheduledBy: "Supervisor QA",
      crewId: CREW_A.id,
      crew: CREW_A.name,
    },
    crews: [CREW_A],
    referenceDate: new Date("2026-07-01T12:00:00.000Z"),
  })

  assert.equal("ok" in plan, false)
  assert.equal(plan.workflowAction, "reschedule-from-active-incident")
  assert.equal(plan.taskPayload.status, "asignada")
  assert.equal(plan.taskPayload.scheduledTime, "08:30:00")
  assert.equal(plan.taskPayload.rescheduleReason, "material-no-disponible")
  assert.equal(plan.taskPayload.rescheduledBy, "Supervisor QA")
  assert.match(plan.incidentEventComment, /material-no-disponible|Reprogramada/)
})

test("buildSupervisorRescheduleActiveTaskPlan no expone transición genérica en payload intermedio", () => {
  const plan = buildSupervisorRescheduleActiveTaskPlan({
    task: buildTask(),
    allTasks: [buildTask()],
    rescheduleInput: {
      dueDate: "2026-07-11",
      scheduledTime: "08:30",
      reason: "otro",
      rescheduledBy: "Supervisor QA",
      crewId: CREW_A.id,
    },
    crews: [CREW_A],
    referenceDate: new Date("2026-07-01T12:00:00.000Z"),
  })

  assert.equal("ok" in plan, false)
  assert.equal(plan.workflowAction, "reschedule-from-active-incident")
})
