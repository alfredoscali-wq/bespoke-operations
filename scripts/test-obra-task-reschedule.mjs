/**
 * Reprogramar OT vencidas en Obras — reglas, lookup, fechas y no-regresión.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { mapWorkflowActionToActivityEmissions } from "../lib/activity/adapters/tasks-activity.ts"
import { ACTIVITY_ACTIONS } from "../lib/activity/types.ts"
import { mapWorkflowActionToAuditAction } from "../lib/audit/tasks-audit.ts"
import { AUDIT_ACTIONS } from "../lib/audit/types.ts"
import { toLocalDateOnly } from "../lib/dates/date-only.ts"
import {
  assertProjectTaskReschedulePayloadSafe,
  canRescheduleProjectTask,
  canRescheduleProjectTaskFromSession,
  getProjectTaskRescheduleBlockedMessage,
  loadProjectTaskForReschedule,
  PROJECT_TASK_RESCHEDULE_STATUSES,
  resolveProjectTaskRescheduleInitialDueDate,
  resolveProjectTaskRescheduleTargetStatus,
  resolveRescheduleSourceTask,
} from "../lib/projects/project-task-reschedule.ts"
import { resolveProjectTaskRowActions } from "../lib/projects/project-task-row-actions.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"
import {
  buildTaskRescheduleUpdatePayload,
  validateTaskRescheduleInput,
} from "../lib/tasks/reschedule.ts"
import {
  canPerformTaskAction,
  getTransitionForAction,
} from "../lib/tasks/task-status-workflow.ts"
import {
  isOverdueForAutoVencida,
  isTaskVencida,
  validateRescheduleFromVencida,
} from "../lib/tasks/vencida-status.ts"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function obrasUser() {
  return {
    systemRole: "supervisor",
    roleCode: "sup",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      projects: true,
    },
  }
}

function noObrasUser() {
  return {
    systemRole: "operario",
    roleCode: "op",
    moduleVisibility: createEmptyModuleVisibility(),
  }
}

function makeObraTask(overrides = {}) {
  return {
    id: "ot-vencida-1",
    code: "OB-001-01",
    title: "Tendido",
    description: "",
    projectId: "project-1",
    projectCode: "OB-001",
    projectName: "Obra Norte",
    type: "fiber",
    status: "vencida",
    priority: "media",
    supervisor: "Supervisor",
    crewId: "crew-1",
    crew: "Cuadrilla A",
    startDate: "2026-09-20",
    dueDate: "2026-09-20",
    scheduledTime: "08:00",
    estimatedDuration: "4h",
    checklist: [{ id: "c1", label: "Foto", completed: true, required: true }],
    operationalSteps: [
      {
        id: "s1",
        label: "Paso",
        observation: "ok",
        completedAt: "2026-09-20T12:00:00.000Z",
      },
    ],
    progress: 40,
    taskMetadata: { evidenceCount: 2 },
    ...overrides,
  }
}

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
    canRescheduleProjectTask({ projectId: "p1", status: "incidencia" }),
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

test("1. OT vencida puede ser reprogramada", () => {
  const task = makeObraTask()
  assert.equal(canRescheduleProjectTask(task), true)
  assert.equal(canPerformTaskAction(task, "reschedule-obra").allowed, true)
  const today = "2026-10-02"
  const validation = validateTaskRescheduleInput(
    { dueDate: today, scheduledTime: "09:00", reason: "clima" },
    {
      referenceDate: new Date(2026, 9, 2, 18, 30, 0),
      current: task,
    }
  )
  assert.equal(validation.allowed, true)
})

test("2. OT vencida de otra company no puede modificarse", async () => {
  const foreignTask = makeObraTask({ id: "ot-other-company" })
  const result = await loadProjectTaskForReschedule(
    foreignTask.id,
    "company-a",
    {
      loadLiveTask: async (companyId, taskId) => {
        if (companyId !== "company-a" || taskId !== "ot-own") {
          return {
            data: null,
            error: { code: "NOT_FOUND", message: "Orden de trabajo no encontrada." },
          }
        }
        return { data: makeObraTask({ id: "ot-own" }), error: null }
      },
    }
  )
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /no encontrada/i)
  }

  const queries = read("lib/supabase/tasks.queries.ts")
  assert.match(queries, /export async function fetchLiveTaskByCompanyAndId/)
  assert.match(
    queries,
    /\.eq\("company_id", companyId\)[\s\S]{0,80}\.eq\("id", id\)/
  )
})

test("3. Usuario sin permiso no puede reprogramar", () => {
  assert.equal(
    canRescheduleProjectTaskFromSession(noObrasUser(), {
      projectId: "p1",
      status: "vencida",
    }),
    false
  )
})

test("4. Usuario autorizado puede reprogramar", () => {
  assert.equal(
    canRescheduleProjectTaskFromSession(obrasUser(), {
      projectId: "p1",
      status: "vencida",
    }),
    true
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

test("5-10. Nueva fecha persiste; no duplica; conserva proyecto, cuadrilla y checklist", () => {
  const task = makeObraTask()
  const targetStatus = resolveProjectTaskRescheduleTargetStatus(task)
  const payload = buildTaskRescheduleUpdatePayload(
    task,
    {
      dueDate: "2026-10-08",
      scheduledTime: "09:30",
      reason: "clima",
      notes: "Reprogramada desde Obras",
      rescheduledBy: "Supervisor",
    },
    targetStatus
  )

  assert.equal(payload.dueDate, "2026-10-08")
  assert.equal(payload.startDate, "2026-10-08")
  assert.equal(payload.status, "asignada")
  assert.equal(assertProjectTaskReschedulePayloadSafe(payload), true)
  assert.equal(payload.projectId, undefined)
  assert.equal(payload.code, undefined)
  assert.equal(payload.crewId, undefined)
  assert.equal(payload.crew, undefined)
  assert.equal(payload.checklist, undefined)
  assert.equal(payload.operationalSteps, undefined)
  assert.equal(task.projectId, "project-1")
  assert.equal(task.crewId, "crew-1")
  assert.equal(task.checklist.length, 1)
  assert.equal(task.operationalSteps.length, 1)
})

test("6. La OT deja de estar vencida cuando la nueva fecha no está vencida", () => {
  const task = makeObraTask()
  const nextStatus = resolveProjectTaskRescheduleTargetStatus(task)
  const nextDueDate = "2026-10-08"
  const after = {
    ...task,
    status: nextStatus,
    dueDate: nextDueDate,
    startDate: nextDueDate,
  }
  const reference = new Date(2026, 9, 2, 10, 0, 0)
  assert.equal(isTaskVencida(task), true)
  assert.equal(isTaskVencida(after), false)
  assert.equal(isOverdueForAutoVencida(after, reference), false)
})

test("11. Se registra auditoría de reprogramación", () => {
  assert.equal(
    mapWorkflowActionToAuditAction("reschedule-obra"),
    AUDIT_ACTIONS.TASK_RESCHEDULE
  )

  const before = makeObraTask()
  const after = makeObraTask({
    status: "asignada",
    dueDate: "2026-10-08",
    scheduledTime: "09:30",
  })
  const emissions = mapWorkflowActionToActivityEmissions(
    "reschedule-obra",
    /** @type {any} */ (before),
    /** @type {any} */ (after),
    {
      dueDate: "2026-10-08",
      scheduledTime: "09:30",
      reason: "clima",
      rescheduledBy: "Supervisor",
    }
  )
  assert.equal(emissions[0].action, ACTIVITY_ACTIONS.TASK_RESCHEDULE)
  assert.equal(emissions[0].metadata.oldDate, "2026-09-20")
  assert.equal(emissions[0].metadata.newDate, "2026-10-08")

  const audit = read("lib/audit/tasks-audit.ts")
  assert.match(audit, /case "reschedule-obra":/)
  assert.match(audit, /previousDate: before\.dueDate/)
  assert.match(audit, /newDate: after\.dueDate/)
  assert.match(audit, /rescheduledBy: input\.rescheduledBy/)
})

test("12. Las OT que ya podían reprogramarse siguen funcionando", () => {
  for (const status of ["programada", "asignada", "incidencia"]) {
    assert.equal(
      canRescheduleProjectTask({ projectId: "p1", status }),
      true
    )
    assert.equal(
      canPerformTaskAction(
        /** @type {any} */ ({ status }),
        "reschedule-obra"
      ).allowed,
      true
    )
  }

  const assigned = makeObraTask({
    status: "asignada",
    dueDate: "2026-10-05",
  })
  assert.equal(resolveProjectTaskRescheduleTargetStatus(assigned), "asignada")
  const validation = validateTaskRescheduleInput(
    { dueDate: "2026-10-12", scheduledTime: "10:00", reason: "cliente-solicito" },
    {
      referenceDate: new Date(2026, 9, 2, 9, 0, 0),
      current: assigned,
    }
  )
  assert.equal(validation.allowed, true)
})

test("13-14. No se modifica force delete ni la eliminación de OT vencidas", () => {
  const rescheduleLib = read("lib/projects/project-task-reschedule.ts")
  const dialog = read("components/obras/project-task-reschedule-dialog.tsx")
  const incidents = read(
    "components/tareas/tasks-provider/hooks/use-tasks-incidents.ts"
  )

  for (const source of [rescheduleLib, dialog, incidents]) {
    assert.doesNotMatch(source, /forceDelete|force-delete|ForceDelete/)
    assert.doesNotMatch(source, /canSoftDeleteVencidaWorkOrder/)
    assert.doesNotMatch(source, /authorizeWorkOrderSoftDelete/)
  }

  const deletionPolicy = read("lib/tasks/work-order-deletion-policy.ts")
  assert.match(deletionPolicy, /export function canSoftDeleteVencidaWorkOrder/)
})

test("Permiso Obras: módulo projects; no requiere admin", () => {
  assert.equal(
    canRescheduleProjectTaskFromSession(obrasUser(), {
      projectId: "p1",
      status: "vencida",
    }),
    true
  )
  assert.equal(
    canRescheduleProjectTaskFromSession(noObrasUser(), {
      projectId: "p1",
      status: "vencida",
    }),
    false
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
  assert.deepEqual(getTransitionForAction("reschedule-obra"), {
    from: ["programada", "asignada", "vencida", "incidencia"],
    to: "asignada",
  })
  assert.deepEqual(PROJECT_TASK_RESCHEDULE_STATUSES, [
    "programada",
    "asignada",
    "vencida",
    "incidencia",
  ])
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

test("Validación de fecha es date-only: hoy con hora pasada está permitida", () => {
  const reference = new Date(2026, 9, 2, 18, 45, 0)
  const allowed = validateRescheduleFromVencida({
    dueDate: "2026-10-02",
    scheduledTime: "08:00",
    referenceDate: reference,
  })
  assert.equal(allowed.allowed, true)

  const past = validateRescheduleFromVencida({
    dueDate: "2026-10-01",
    scheduledTime: "23:59",
    referenceDate: reference,
  })
  assert.equal(past.allowed, false)
  assert.match(past.message ?? "", /fecha pasada/)

  const input = validateTaskRescheduleInput(
    { dueDate: "2026-10-02", scheduledTime: "08:00", reason: "clima" },
    {
      referenceDate: reference,
      current: { dueDate: "2026-09-20", scheduledTime: "08:00" },
    }
  )
  assert.equal(input.allowed, true)
})

test("Modal de Obras arranca en hoy local si la OT ya está vencida", () => {
  const reference = new Date(2026, 9, 2, 9, 0, 0)
  assert.equal(
    resolveProjectTaskRescheduleInitialDueDate(
      { dueDate: "2026-09-20" },
      reference
    ),
    "2026-10-02"
  )
  assert.equal(
    resolveProjectTaskRescheduleInitialDueDate(
      { dueDate: "2026-10-12" },
      reference
    ),
    "2026-10-12"
  )
  assert.equal(toLocalDateOnly(reference), "2026-10-02")
})

test("Lookup: usa la OT de Obras y no depende del listado global", async () => {
  const loaded = makeObraTask({ id: "ot-obra" })
  assert.equal(
    resolveRescheduleSourceTask({
      id: "ot-obra",
      loadedTask: loaded,
      providerTasks: [],
    })?.id,
    "ot-obra"
  )
  assert.equal(
    resolveRescheduleSourceTask({
      id: "ot-obra",
      providerTasks: [],
    }),
    null
  )

  const live = await loadProjectTaskForReschedule("ot-obra", "company-a", {
    providerTasks: [],
    loadLiveTask: async (companyId, taskId) => {
      assert.equal(companyId, "company-a")
      assert.equal(taskId, "ot-obra")
      return { data: loaded, error: null }
    },
  })
  assert.equal(live.ok, true)
  if (live.ok) assert.equal(live.task.id, "ot-obra")
})

test("Wiring UI/mutación: Obras pasa la OT y confirma con existingTask", () => {
  const dialog = read("components/obras/project-task-reschedule-dialog.tsx")
  assert.match(dialog, /resolveProjectTaskRescheduleInitialDueDate/)
  assert.match(dialog, /toLocalDateOnly/)
  assert.doesNotMatch(dialog, /toDateOnly/)
  assert.doesNotMatch(dialog, /UTC-3|America\/Argentina/)
  assert.match(dialog, /Reprogramando\.\.\./)

  const tab = read("components/obras/project-tabs/tasks-tab.tsx")
  assert.match(tab, /task: rescheduleTarget/)
  assert.match(tab, /loadProjectTasks\(\{ silent: true \}\)/)
  assert.match(tab, /Reprogramar/)

  const incidents = read(
    "components/tareas/tasks-provider/hooks/use-tasks-incidents.ts"
  )
  assert.match(incidents, /loadProjectTaskForReschedule/)
  assert.match(incidents, /existingTask: task/)
  assert.match(incidents, /getLiveTaskByCompanyAndId/)
  assert.doesNotMatch(incidents, /createTask\(/)
})
