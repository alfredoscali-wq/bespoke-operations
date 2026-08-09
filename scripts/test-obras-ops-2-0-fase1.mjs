import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildStartProjectDispatchHistoryDescription,
  canEditProjectTaskFromObras,
  resolveProjectTaskCreateStatus,
  shouldApplyPlanningQueueSideEffectsForTask,
  validateStartProjectDispatch,
} from "../lib/projects/project-start-dispatch.ts"
import { validateObraTaskInsertIntegrity } from "../lib/projects/obra-task-insert-integrity.ts"
import {
  filterActiveWorkOrders,
  filterArchivedWorkOrders,
} from "../lib/tasks/task-list-scope.ts"
import { canSoftDeleteWorkOrder } from "../lib/tasks/work-order-deletion-policy.ts"
import {
  isObraPlanningTask,
  isPlanningUniverseTask,
} from "../lib/planificacion/planning-universe.ts"
import { filterObraPlanningTasksForDate } from "../lib/planificacion/planning-crew-state.ts"
import {
  filterProgrammedTasksForPlanning,
  resolvePlanningTaskObraLabel,
} from "../lib/planificacion/planning-utils.ts"
import {
  buildPlanningEditFormFromTask,
  buildPlanningTaskUpdateBatch,
  validatePlanningAdjustForm,
} from "../lib/planificacion/planning-edit.ts"
import { isFieldAgentAgendaTaskVisible } from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20261124000100_obras_ops_2_0_fase1_planning.sql"
)

const COMPANY_A = "company-a"
const PROJECT_A = "project-a"
const CREW_A = "crew-a"

const VALID_GPS = { latitude: 25.6866, longitude: -100.3161 }

function makeObraTask(overrides = {}) {
  return {
    id: "task-1",
    code: "TSK-OB-1",
    status: "borrador",
    crewId: "crew-1",
    dueDate: "2026-07-15",
    projectId: "project-1",
    projectCode: "OB-001",
    projectName: "Obra Norte",
    serviceType: null,
    ...overrides,
  }
}

function makeServiceOt(overrides = {}) {
  return {
    id: "ot-1",
    code: "TSK-OT-001",
    status: "programada",
    crewId: "crew-1",
    dueDate: "2026-07-15",
    projectId: undefined,
    projectCode: "OT",
    projectName: "Cliente Demo",
    serviceType: "service-tecnico",
    customerName: "Cliente Demo",
    estimatedDuration: "45 min",
    taskMetadata: { shift: "manana" },
    scheduledTime: "08:00:00",
    ...overrides,
  }
}

test("OPS 2.0: create status borrador en planned; programada en active", () => {
  assert.equal(resolveProjectTaskCreateStatus("planned"), "borrador")
  assert.equal(resolveProjectTaskCreateStatus("paused"), "borrador")
  assert.equal(resolveProjectTaskCreateStatus("active"), "programada")
})

test("OPS 2.0: start exige borrador con cuadrilla y fecha", () => {
  const ok = validateStartProjectDispatch({
    ...VALID_GPS,
    projectStatus: "planned",
    tasks: [makeObraTask()],
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.dispatchableTasks.length, 1)
  }

  const missingCrew = validateStartProjectDispatch({
    ...VALID_GPS,
    projectStatus: "planned",
    tasks: [makeObraTask({ crewId: null, code: "TSK-NOCREW" })],
  })
  assert.equal(missingCrew.ok, false)

  const legacyProgramadaIgnoredForCrewGate = validateStartProjectDispatch({
    ...VALID_GPS,
    projectStatus: "planned",
    tasks: [makeObraTask({ status: "programada", crewId: null })],
  })
  assert.equal(legacyProgramadaIgnoredForCrewGate.ok, true)
})

test("OPS 2.0: historial menciona Programada / Planificación", () => {
  assert.match(
    buildStartProjectDispatchHistoryDescription(1),
    /Programada.*Planificación/
  )
  assert.match(
    buildStartProjectDispatchHistoryDescription(3),
    /3 tareas pasaron a Programada/
  )
})

test("OPS 2.0: integrity planned → borrador; active → programada", () => {
  const planned = validateObraTaskInsertIntegrity({
    task: {
      companyId: COMPANY_A,
      projectId: PROJECT_A,
      crewId: CREW_A,
      status: "borrador",
    },
    project: {
      id: PROJECT_A,
      companyId: COMPANY_A,
      status: "planned",
      deletedAt: null,
    },
    crew: { id: CREW_A, companyId: COMPANY_A, deletedAt: null },
  })
  assert.equal(planned.ok, true)
  if (planned.ok) assert.equal(planned.status, "borrador")

  const active = validateObraTaskInsertIntegrity({
    task: {
      companyId: COMPANY_A,
      projectId: PROJECT_A,
      crewId: CREW_A,
      status: "borrador",
    },
    project: {
      id: PROJECT_A,
      companyId: COMPANY_A,
      status: "active",
      deletedAt: null,
    },
    crew: { id: CREW_A, companyId: COMPANY_A, deletedAt: null },
  })
  assert.equal(active.ok, true)
  if (active.ok) assert.equal(active.status, "programada")
})

test("OPS 2.0/2.1B: planning side-effects nunca para OT de Obra", () => {
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: "p1",
      status: "borrador",
    }),
    false
  )
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: "p1",
      status: "programada",
    }),
    false
  )
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: null }),
    true
  )
})

test("OPS 2.0: OT Obra no aparece en módulo Órdenes de Trabajo", () => {
  const tasks = [
    makeObraTask({ status: "programada" }),
    makeServiceOt(),
    makeObraTask({ id: "t2", status: "finalizada" }),
    makeServiceOt({ id: "ot-2", status: "finalizada" }),
  ]

  assert.deepEqual(
    filterActiveWorkOrders(tasks).map((t) => t.id),
    ["ot-1"]
  )
  assert.deepEqual(
    filterArchivedWorkOrders(tasks).map((t) => t.id),
    ["ot-2"]
  )
})

test("OPS 2.0/2.1B: borrador fuera; Obra programada en lane obras (no ruta)", () => {
  const draft = makeObraTask({ status: "borrador" })
  const scheduled = makeObraTask({ status: "programada" })
  const service = makeServiceOt()

  assert.equal(isPlanningUniverseTask(draft), true)
  assert.equal(isObraPlanningTask(draft), true)

  const programmed = filterProgrammedTasksForPlanning(
    [draft, scheduled, service],
    { date: "2026-07-15" }
  )
  assert.deepEqual(
    programmed.map((t) => t.id),
    ["ot-1"]
  )
  assert.deepEqual(
    filterObraPlanningTasksForDate([draft, scheduled, service], {
      date: "2026-07-15",
    }).map((t) => t.id),
    ["task-1"]
  )
  assert.equal(resolvePlanningTaskObraLabel(scheduled), "Obra Norte")
  assert.equal(resolvePlanningTaskObraLabel(service), null)
})

test("OPS 2.0/2.1B: Mobile ve Obra programada con cuadrilla; no borrador", () => {
  const today = "2026-07-15"
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      { status: "borrador", startDate: today, dueDate: today, projectId: "p1" },
      today
    ),
    false
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "programada",
        startDate: today,
        dueDate: today,
        projectId: "p1",
        crewId: "crew-1",
      },
      today
    ),
    true
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "programada",
        startDate: today,
        dueDate: today,
        projectId: undefined,
      },
      today
    ),
    false
  )
})

test("OPS 2.0: soft delete permite borrador", () => {
  assert.equal(canSoftDeleteWorkOrder("borrador"), true)
  assert.equal(
    canSoftDeleteWorkOrder({ status: "borrador", projectId: "p1" }),
    true
  )
})

test("OPS 2.0: editable desde Obras en borrador", () => {
  assert.equal(
    canEditProjectTaskFromObras({ projectId: "p1", status: "borrador" }),
    true
  )
})

test("OPS 2.0: adjust planning permite fecha + crew + duración", () => {
  const task = makeServiceOt()
  const form = {
    ...buildPlanningEditFormFromTask(task, [task], [
      { id: "crew-1", name: "Cuadrilla 1" },
    ]),
    scheduledDate: "2026-07-20",
    crewId: "crew-1",
    shift: "tarde",
    estimatedDurationPreset: "60",
  }

  assert.equal(validatePlanningAdjustForm(form).valid, true)

  const batch = buildPlanningTaskUpdateBatch({
    task,
    form,
    crew: { id: "crew-1", name: "Cuadrilla 1", supervisor: "Sup" },
    allTasks: [task],
    crews: [{ id: "crew-1", name: "Cuadrilla 1" }],
  })

  assert.equal(batch.primaryPayload.dueDate, "2026-07-20")
  assert.equal(batch.primaryPayload.startDate, "2026-07-20")
  assert.equal(batch.primaryPayload.estimatedDuration, "60 min")
})

test("OPS 2.0 migración: borrador enum + promote a programada sin limpiar lane", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")

  assert.match(sql, /ADD VALUE IF NOT EXISTS 'borrador'/)
  assert.match(sql, /old_status = 'borrador' AND new_status IN \('programada', 'cancelada'\)/)
  assert.match(sql, /NEW\.status := 'borrador'::public\.task_status/)
  assert.match(sql, /NEW\.status := 'programada'::public\.task_status/)
  assert.match(sql, /t\.status = 'borrador'::public\.task_status/)
  assert.match(sql, /status = 'programada'::public\.task_status/)
  assert.doesNotMatch(sql, /execution_order = NULL/)
  assert.doesNotMatch(sql, /status = 'asignada'::public\.task_status/)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/)
})
